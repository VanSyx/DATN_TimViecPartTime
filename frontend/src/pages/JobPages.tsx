import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Application, type Interval, type Job, type JobInput, type JobSearch, type Recommendations, type User } from '../api'
import { useSubmit } from './AuthPages'

// Trung tâm Đà Nẵng làm điểm khởi đầu khi chưa chọn vị trí nào
const VN_CENTER: [number, number] = [16.047079, 108.20623]
const pinIcon = L.divIcon({ className: 'map-pin', html: '📍', iconSize: [28, 28], iconAnchor: [14, 28] })

const statusLabel: Record<string, string> = {
  open: 'Đang mở',
  closed: 'Đã đóng',
  pending_approval: 'Chờ admin duyệt',
  rejected: 'Bị từ chối',
  pending: 'Chờ duyệt',
  accepted: 'Đã nhận',
  cancelled: 'Đã hủy',
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

const fmtRange = (start: string, end: string) => `${fmtTime(start)} → ${fmtTime(end)}`

// <input type="datetime-local"> dùng giờ địa phương không kèm múi giờ; API cần ISO có offset
const toIso = (local: FormDataEntryValue | null) => (local ? new Date(String(local)).toISOString() : '')

function toLocalInput(iso: string) {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/** Tải dữ liệu 1 lần + hàm reload sau khi thay đổi. */
function useLoad<T>(load: () => Promise<T>, initial: T) {
  const [data, setData] = useState(initial)
  const [error, setError] = useState('')
  const reload = useCallback(() => {
    load().then(setData, (err: Error) => setError(err.message))
  }, [load])
  useEffect(reload, [reload])
  return { data, error, reload }
}

type GeoHit = { label: string; lat: number; lng: number }

/**
 * Tra địa chỉ → toạ độ qua Photon (OSM, miễn phí, không cần API key), gọi thẳng từ trình duyệt
 * nên không dính lý do Nominatim bị chặn IP server — xem CLAUDE.md mục 5.
 * Chỉ tới mức tên đường/địa danh: OSM Việt Nam thiếu dữ liệu số nhà, nên trả nhiều kết quả cho
 * người dùng tự chọn thay vì ghim bừa theo kết quả đầu (địa chỉ không tồn tại vẫn ra match sai).
 */
async function geocode(q: string, near: L.LatLng): Promise<GeoHit[]> {
  const url = `https://photon.komoot.io/api/?limit=5&lang=default&lat=${near.lat}&lon=${near.lng}&q=${encodeURIComponent(q)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Không tra được địa chỉ, hãy bấm ghim thủ công trên bản đồ')
  const data = await res.json()
  const hits: GeoHit[] = (data.features ?? []).map((f: any) => ({
    label: [f.properties.name, f.properties.street, f.properties.district, f.properties.city]
      .filter(Boolean)
      .join(', '),
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }))
  if (!hits.length) throw new Error('Không tìm thấy địa chỉ này, hãy bấm ghim thủ công trên bản đồ')
  return hits
}

/** Địa chỉ để tra: ưu tiên 3 ô street/ward/city của form đăng tin, không có thì lấy ô riêng của picker. */
function readAddress(form: HTMLFormElement): string {
  const val = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? ''
  return [val('street'), val('ward'), val('city')].filter(Boolean).join(', ') || val('address_q')
}

/**
 * Bản đồ OSM để bấm/kéo ghim lấy lat/lng, kèm tra địa chỉ để nhảy ghim tới đúng khu vực.
 * Tự quản state, xuất toạ độ qua 2 input ẩn name="lat"/"lng" để form cha đọc qua FormData.
 */
function LocationPicker({ initialLat, initialLng, height = 240, showAddressInput }: { initialLat?: number; initialLng?: number; height?: number; showAddressInput?: boolean }) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapApi = useRef<{ map: L.Map; setMarker: (lat: number, lng: number) => void }>(undefined)
  const [coords, setCoords] = useState(initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null)
  const [error, setError] = useState('')
  const [hits, setHits] = useState<GeoHit[] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!mapEl.current) return
    const map = L.map(mapEl.current).setView(coords ? [coords.lat, coords.lng] : VN_CENTER, coords ? 15 : 6)
    // tile.openstreetmap.org (server chính) hay bị chặn/timeout tuỳ mạng — dùng mirror Đức, cùng dữ liệu OSM, không cần key
    L.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    let marker: L.Marker | null = null
    function setMarker(lat: number, lng: number) {
      if (marker) marker.setLatLng([lat, lng])
      else marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map).on('dragend', () => {
        const p = marker!.getLatLng()
        updateCoords(p.lat, p.lng)
      })
    }
    function updateCoords(lat: number, lng: number) {
      setMarker(lat, lng)
      setCoords({ lat, lng })
    }
    if (coords) setMarker(coords.lat, coords.lng)
    else {
      // Chưa có toạ độ (form mới, không phải sửa job có sẵn) → thử định vị GPS để zoom gần
      // vị trí thật thay vì giữ nguyên view Đà Nẵng zoom 6 (tải nhiều tile, xa vị trí thật user).
      navigator.geolocation.getCurrentPosition(
        (p) => {
          map.setView([p.coords.latitude, p.coords.longitude], 15)
          updateCoords(p.coords.latitude, p.coords.longitude)
        },
        () => {}, // từ chối/không hỗ trợ → giữ fallback Đà Nẵng, không báo lỗi (khác nút chủ động bên dưới)
      )
    }
    map.on('click', (e) => updateCoords(e.latlng.lat, e.latlng.lng))

    mapApi.current = { map, setMarker }
    return () => { map.remove() }
    // eslint-disable-next-line -- chỉ tạo map 1 lần lúc mount; đổi initial thì remount qua key ở nơi gọi
  }, [])

  function goTo(lat: number, lng: number, zoom: number) {
    mapApi.current?.map.setView([lat, lng], zoom)
    mapApi.current?.setMarker(lat, lng)
    setCoords({ lat, lng })
  }

  function locateMe() {
    setError('')
    setHits(null)
    navigator.geolocation.getCurrentPosition(
      (p) => goTo(p.coords.latitude, p.coords.longitude, 15),
      () => setError('Không lấy được vị trí hiện tại'),
    )
  }

  async function searchAddress(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.form
    const map = mapApi.current?.map
    if (!form || !map) return
    const q = readAddress(form)
    setError('')
    setHits(null)
    if (!q) {
      setError('Hãy nhập địa chỉ trước khi định vị')
      return
    }
    setSearching(true)
    try {
      setHits(await geocode(q, map.getCenter()))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="wide">
      {showAddressInput && (
        <label>Địa chỉ<input name="address_q" placeholder="Ví dụ: Hồ Gươm, Hà Nội" /></label>
      )}
      <div className="actions">
        <button type="button" className="secondary" onClick={searchAddress} disabled={searching}>
          {searching ? 'Đang tra...' : 'Định vị trên bản đồ'}
        </button>
        <button type="button" className="secondary" onClick={locateMe}>Dùng vị trí hiện tại</button>
        {coords && <span className="meta">Đã chọn: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>}
      </div>
      <p className="meta">Tra địa chỉ chỉ tới mức tên đường — bấm vào bản đồ hoặc kéo ghim để chỉnh đúng số nhà.</p>
      {hits && (
        <ul className="geo-hits">
          {hits.map((hit) => (
            <li key={`${hit.lat},${hit.lng}`}>
              <button type="button" onClick={() => { goTo(hit.lat, hit.lng, 17); setHits(null) }}>
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div ref={mapEl} className="map-picker" style={{ height }} />
      <input type="hidden" name="lat" value={coords?.lat ?? ''} />
      <input type="hidden" name="lng" value={coords?.lng ?? ''} />
      {error && <p className="error">{error}</p>}
    </div>
  )
}

const fullAddress = (job: Job) => [job.street, job.ward, job.city].filter(Boolean).join(', ')

function JobInfo({ job }: { job: Job }) {
  return (
    <>
      <h3>{job.title}</h3>
      <p className="meta">
        {fullAddress(job)}
        {job.distance_km !== null && ` · cách ${job.distance_km} km`}
      </p>
      <p className="meta">
        {fmtRange(job.time_start, job.time_end)} · {job.salary.toLocaleString('vi-VN')} đ
      </p>
      <p>{job.description}</p>
    </>
  )
}

// ---------- Job Seeker ----------

function ApplyButton({ job }: { job: Job }) {
  const [result, setResult] = useState('')
  if (result) return <span className="meta">{result}</span>
  return (
    <button onClick={() => api.apply(job.id).then(() => setResult('Đã ứng tuyển'), (err: Error) => setResult(err.message))}>
      Ứng tuyển
    </button>
  )
}

export function SearchJobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const { error, busy, wrap } = useSubmit()

  const search = wrap(async (f) => {
    const params: JobSearch = {
      lat: String(f.get('lat') ?? ''),
      lng: String(f.get('lng') ?? ''),
      radius_km: String(f.get('radius_km') ?? ''),
      start: toIso(f.get('start')),
      end: toIso(f.get('end')),
    }
    setJobs(await api.searchJobs(params))
  })

  useEffect(() => {
    api.searchJobs({}).then(setJobs, () => setJobs([]))
  }, [])

  return (
    <div className="page">
      <h1>Tìm việc</h1>
      <form className="panel" onSubmit={search}>
        <LocationPicker showAddressInput />
        <label>Bán kính (km)<input name="radius_km" type="number" min={1} max={100} defaultValue={10} /></label>
        <label>Rảnh từ<input name="start" type="datetime-local" /></label>
        <label>Đến<input name="end" type="datetime-local" /></label>
        <button disabled={busy}>{busy ? 'Đang tìm...' : 'Tìm'}</button>
        {error && <p className="error wide" role="alert">{error}</p>}
      </form>

      {jobs?.length === 0 && <p className="meta">Không có việc nào phù hợp.</p>}
      {jobs?.map((job) => (
        <article className="card" key={job.id}>
          <JobInfo job={job} />
          <div className="actions"><ApplyButton job={job} /></div>
        </article>
      ))}
    </div>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <label className="score">
      <span>{label}</span>
      <meter min={0} max={1} low={0.34} high={0.67} optimum={1} value={value} />
      <span>{Math.round(value * 100)}%</span>
    </label>
  )
}

export function RecommendPage() {
  const [result, setResult] = useState<Recommendations | null>(null)
  const { error, busy, wrap } = useSubmit()
  const { data: me } = useLoad<User | null>(api.me, null)
  const { data: intervals } = useLoad<Interval[] | null>(api.availability, null)

  // Thiếu mô tả → semantic = 0; không còn khoảng rảnh sắp tới → time_feasibility = 0 với mọi job
  const missing = [
    me && !me.description?.trim() && 'mô tả bản thân',
    intervals && !intervals.some((i) => new Date(i.end_time) > new Date()) && 'lịch rảnh sắp tới',
  ].filter(Boolean)

  const recommend = wrap(async (f) => {
    const lat = String(f.get('lat') ?? '')
    const lng = String(f.get('lng') ?? '')
    if (!lat || !lng) throw new Error('Hãy chọn vị trí của bạn trên bản đồ')
    setResult(await api.recommendations({ lat, lng, radius_km: String(f.get('radius_km') ?? '') }))
  })

  return (
    <div className="page">
      <h1>Gợi ý cho tôi</h1>
      <p className="meta">AI xếp hạng việc gần bạn theo mức khớp mô tả, giờ rảnh (tính cả thời gian đi lại) và khoảng cách.</p>
      {missing.length > 0 && (
        <p className="banner">
          Bạn chưa khai {missing.join(' và ')}, gợi ý sẽ kém chính xác.{' '}
          <Link to="/seeker/availability">Cập nhật hồ sơ & lịch rảnh</Link>
        </p>
      )}
      <form className="panel" onSubmit={recommend}>
        <LocationPicker showAddressInput />
        <label>Bán kính (km)<input name="radius_km" type="number" min={1} max={100} defaultValue={10} /></label>
        <button disabled={busy}>{busy ? 'Đang gợi ý...' : 'Gợi ý việc'}</button>
        {error && <p className="error wide" role="alert">{error}</p>}
      </form>

      {result?.source === 'fallback' && (
        <p className="banner">AI tạm thời không phản hồi — đang xếp theo khoảng cách.</p>
      )}
      {result?.items.length === 0 && <p className="meta">Không có việc nào đang mở trong bán kính này.</p>}
      {result?.items.map(({ job, final_score, breakdown, travel_minutes }) => (
        <article className="card" key={job.id}>
          <JobInfo job={job} />
          {breakdown && (
            <div className="scores">
              <Score label="Khớp mô tả" value={breakdown.semantic} />
              <Score label={`Khớp giờ rảnh (tính cả ${travel_minutes} phút đi lại)`} value={breakdown.time_feasibility} />
              <Score label={`Khoảng cách ${job.distance_km} km`} value={breakdown.geo} />
              <Score label="Độ tin cậy (mặc định, chưa có đánh giá)" value={breakdown.trust} />
            </div>
          )}
          <div className="actions">
            <strong>Điểm phù hợp: {Math.round(final_score * 100)}%</strong>
            <ApplyButton job={job} />
          </div>
        </article>
      ))}
    </div>
  )
}

export function AvailabilityPage() {
  const { data: intervals, error: loadError, reload } = useLoad<Interval[]>(api.availability, [])
  const { error, busy, wrap } = useSubmit()

  const { data: me } = useLoad<User | null>(api.me, null)
  const profile = useSubmit()
  const [saved, setSaved] = useState(false)

  const add = wrap(async (f) => {
    await api.addAvailability(toIso(f.get('start')), toIso(f.get('end')))
    reload()
  })

  const saveDescription = profile.wrap(async (f) => {
    await api.updateProfile(String(f.get('description')))
    setSaved(true)
  })

  return (
    <div className="page">
      <h1>Mô tả bản thân</h1>
      <p className="meta">Kỹ năng, loại việc muốn làm — AI dùng để khớp với mô tả công việc.</p>
      {me && (
        <form className="panel" onSubmit={saveDescription} onChange={() => setSaved(false)}>
          <label className="wide">Mô tả
            <textarea name="description" rows={3} maxLength={2000} defaultValue={me.description ?? ''}
              placeholder="VD: Dọn dẹp nhà cửa, nấu ăn gia đình, trông trẻ buổi tối" />
          </label>
          <button disabled={profile.busy}>Lưu</button>
          {saved && <span className="meta">Đã lưu</span>}
          {profile.error && <p className="error wide" role="alert">{profile.error}</p>}
        </form>
      )}

      <h1>Lịch rảnh</h1>
      <p className="meta">Khai báo các khoảng thời gian bạn rảnh — dùng để lọc và gợi ý việc phù hợp.</p>
      <form className="panel" onSubmit={add}>
        <label>Từ<input name="start" type="datetime-local" required /></label>
        <label>Đến<input name="end" type="datetime-local" required /></label>
        <button disabled={busy}>Thêm</button>
        {(error || loadError) && <p className="error wide" role="alert">{error || loadError}</p>}
      </form>
      {intervals.length === 0 && <p className="meta">Chưa khai báo khoảng rảnh nào.</p>}
      {intervals.map((i) => (
        <div className="card actions" key={i.id}>
          <span>{fmtRange(i.start_time, i.end_time)}</span>
          <button className="secondary" onClick={() => api.deleteAvailability(i.id).then(reload)}>Xóa</button>
        </div>
      ))}
    </div>
  )
}

export function MyApplicationsPage() {
  const { data: applications, error, reload } = useLoad<Application[]>(api.myApplications, [])

  return (
    <div className="page">
      <h1>Đơn ứng tuyển của tôi</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {applications.length === 0 && <p className="meta">Bạn chưa ứng tuyển việc nào.</p>}
      {applications.map((a) => (
        <article className="card" key={a.id}>
          <JobInfo job={a.job} />
          <div className="actions">
            <span className={`badge ${a.status}`}>{statusLabel[a.status]}</span>
            {a.status === 'pending' && (
              <button className="secondary" onClick={() => api.setApplicationStatus(a.id, 'cancelled').then(reload)}>
                Hủy đơn
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

// ---------- Employer ----------

function JobForm({ job, onSaved, onCancel }: { job: Job | null; onSaved: () => void; onCancel: () => void }) {
  const { error, busy, wrap } = useSubmit()

  const save = wrap(async (f) => {
    const lat = f.get('lat')
    const lng = f.get('lng')
    if (!lat || !lng) throw new Error('Vui lòng chọn vị trí trên bản đồ')
    const data: JobInput = {
      title: String(f.get('title')),
      description: String(f.get('description')),
      street: String(f.get('street')).trim(),
      ward: String(f.get('ward')).trim(),
      city: String(f.get('city')).trim(),
      lat: Number(lat),
      lng: Number(lng),
      time_start: toIso(f.get('time_start')),
      time_end: toIso(f.get('time_end')),
      salary: Number(f.get('salary')),
    }
    await (job ? api.updateJob(job.id, data) : api.createJob(data))
    onSaved()
  })

  return (
    <form className="panel" onSubmit={save}>
      <h2 className="wide">{job ? 'Sửa tin' : 'Đăng tin mới'}</h2>
      <label className="wide">Tiêu đề<input name="title" required minLength={3} maxLength={200} defaultValue={job?.title} /></label>
      <label className="wide">
        Mô tả công việc
        <textarea name="description" required rows={3} maxLength={5000} defaultValue={job?.description} />
      </label>
      <label>
        Số nhà, tên đường
        <input name="street" required minLength={2} maxLength={200} placeholder="70 Phan Huy Ôn" defaultValue={job?.street} />
      </label>
      <label>
        Phường/Xã
        <input name="ward" required minLength={2} maxLength={100} placeholder="Phường Hải Châu" defaultValue={job?.ward} />
      </label>
      <label>
        Tỉnh/Thành phố
        <input name="city" required minLength={2} maxLength={100} placeholder="Đà Nẵng" defaultValue={job?.city} />
      </label>
      <LocationPicker initialLat={job?.lat} initialLng={job?.lng} />
      <label>Bắt đầu<input name="time_start" type="datetime-local" required defaultValue={job ? toLocalInput(job.time_start) : undefined} /></label>
      <label>Kết thúc<input name="time_end" type="datetime-local" required defaultValue={job ? toLocalInput(job.time_end) : undefined} /></label>
      <label>Lương (VND)<input name="salary" type="number" min={0} step={1000} required defaultValue={job?.salary} /></label>
      <div className="actions wide">
        <button disabled={busy}>{job ? 'Lưu thay đổi' : 'Đăng tin'}</button>
        {job && <button type="button" className="secondary" onClick={onCancel}>Hủy sửa</button>}
      </div>
      {error && <p className="error wide" role="alert">{error}</p>}
    </form>
  )
}

function Applicants({ job }: { job: Job }) {
  const load = useCallback(() => api.jobApplications(job.id), [job.id])
  const { data: applications, error, reload } = useLoad<Application[]>(load, [])

  const decide = (a: Application, status: 'accepted' | 'rejected') =>
    api.setApplicationStatus(a.id, status).then(reload)

  if (error) return <p className="error">{error}</p>
  if (applications.length === 0) return <p className="meta">Chưa có ai ứng tuyển.</p>
  return (
    <ul className="applicants">
      {applications.map((a) => (
        <li key={a.id} className="actions">
          <span>{a.job_seeker.email}{a.job_seeker.phone && ` · ${a.job_seeker.phone}`}</span>
          <span className={`badge ${a.status}`}>{statusLabel[a.status]}</span>
          {a.status === 'pending' && (
            <>
              <button onClick={() => decide(a, 'accepted')}>Nhận</button>
              <button className="secondary" onClick={() => decide(a, 'rejected')}>Từ chối</button>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

export function EmployerJobsPage() {
  const { data: jobs, error, reload } = useLoad<Job[]>(api.myJobs, [])
  const [editing, setEditing] = useState<Job | null>(null)
  const [openApplicants, setOpenApplicants] = useState<string | null>(null)

  function saved() {
    setEditing(null)
    reload()
  }

  return (
    <div className="page">
      <h1>Tin tuyển dụng của bạn</h1>
      {/* key: đổi tin đang sửa thì form reset lại defaultValue */}
      <JobForm key={editing?.id ?? 'new'} job={editing} onSaved={saved} onCancel={() => setEditing(null)} />
      {error && <p className="error" role="alert">{error}</p>}
      {jobs.length === 0 && <p className="meta">Bạn chưa đăng tin nào.</p>}
      {jobs.map((job) => (
        <article className="card" key={job.id}>
          <JobInfo job={job} />
          <div className="actions">
            <span className={`badge ${job.status}`}>{statusLabel[job.status]}</span>
            <button className="secondary" onClick={() => setOpenApplicants(openApplicants === job.id ? null : job.id)}>
              {openApplicants === job.id ? 'Ẩn đơn ứng tuyển' : 'Xem đơn ứng tuyển'}
            </button>
            {job.status === 'open' && (
              <>
                <button className="secondary" onClick={() => { setEditing(job); window.scrollTo(0, 0) }}>Sửa</button>
                <button className="secondary" onClick={() => api.closeJob(job.id).then(reload)}>Đóng tin</button>
              </>
            )}
          </div>
          {openApplicants === job.id && <Applicants job={job} />}
        </article>
      ))}
    </div>
  )
}
