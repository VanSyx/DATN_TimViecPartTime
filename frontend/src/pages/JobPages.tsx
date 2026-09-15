import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type Application, type Interval, type Job, type JobInput, type JobSearch } from '../api'
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

/**
 * Bản đồ OSM (chỉ hiển thị tile, không gọi API tìm kiếm địa chỉ nào) để bấm ghép ghim lấy lat/lng.
 * Không dùng geocoding bên thứ 3 (Goong cần admin duyệt key, Nominatim chặn IP server) — xem CLAUDE.md mục 5.
 * Tự quản state, xuất toạ độ qua 2 input ẩn name="lat"/"lng" để form cha đọc qua FormData.
 */
function LocationPicker({ initialLat, initialLng, height = 240 }: { initialLat?: number; initialLng?: number; height?: number }) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapApi = useRef<{ map: L.Map; setMarker: (lat: number, lng: number) => void }>(undefined)
  const [coords, setCoords] = useState(initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!mapEl.current) return
    const map = L.map(mapEl.current).setView(coords ? [coords.lat, coords.lng] : VN_CENTER, coords ? 15 : 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    let marker: L.Marker | null = null
    function setMarker(lat: number, lng: number) {
      if (marker) marker.setLatLng([lat, lng])
      else marker = L.marker([lat, lng], { icon: pinIcon }).addTo(map)
    }
    if (coords) setMarker(coords.lat, coords.lng)
    map.on('click', (e) => {
      setMarker(e.latlng.lat, e.latlng.lng)
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    mapApi.current = { map, setMarker }
    return () => { map.remove() }
    // eslint-disable-next-line -- chỉ tạo map 1 lần lúc mount; đổi initial thì remount qua key ở nơi gọi
  }, [])

  function locateMe() {
    setError('')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lng } = p.coords
        mapApi.current?.map.setView([lat, lng], 15)
        mapApi.current?.setMarker(lat, lng)
        setCoords({ lat, lng })
      },
      () => setError('Không lấy được vị trí hiện tại'),
    )
  }

  return (
    <div className="wide">
      <div className="actions">
        <span className="meta">Bấm vào bản đồ để chọn vị trí</span>
        <button type="button" className="secondary" onClick={locateMe}>Dùng vị trí hiện tại</button>
        {coords && <span className="meta">Đã chọn: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>}
      </div>
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

export function SearchJobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [applied, setApplied] = useState<Record<string, string>>({})
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

  async function apply(job: Job) {
    try {
      await api.apply(job.id)
      setApplied((a) => ({ ...a, [job.id]: 'Đã ứng tuyển' }))
    } catch (err) {
      setApplied((a) => ({ ...a, [job.id]: (err as Error).message }))
    }
  }

  return (
    <div className="page">
      <h1>Tìm việc</h1>
      <form className="panel" onSubmit={search}>
        <LocationPicker />
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
          <div className="actions">
            {applied[job.id] ? <span className="meta">{applied[job.id]}</span>
              : <button onClick={() => apply(job)}>Ứng tuyển</button>}
          </div>
        </article>
      ))}
    </div>
  )
}

export function AvailabilityPage() {
  const { data: intervals, error: loadError, reload } = useLoad<Interval[]>(api.availability, [])
  const { error, busy, wrap } = useSubmit()

  const add = wrap(async (f) => {
    await api.addAvailability(toIso(f.get('start')), toIso(f.get('end')))
    reload()
  })

  return (
    <div className="page">
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
