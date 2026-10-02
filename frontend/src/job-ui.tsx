import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, ApiError, type ApplicationStatus, type Interval, type Job, type Recommendations } from './api'
import { useAuth } from './auth'
import {
  AppStatusBadge, dateInput, FieldError, fmtDay, fmtHM, fmtHours, fmtMoney, fmtNum, fmtPct, fmtSlot, fullAddress, Icon, IconLine,
  jobEnded, JobStatusBadge, Modal, ModalHeader, ScoreRing, Spinner, useLoad, useToast, type IconName,
} from './ui'

export type Rec = Recommendations['items'][number]
export type Place = { label: string; lat: number; lng: number }

// Trung tâm Đà Nẵng làm điểm khởi đầu khi chưa chọn vị trí nào
export const VN_CENTER: [number, number] = [16.047079, 108.20623]

// ---------- Bản đồ ----------

export function createMap(el: HTMLElement, center: L.LatLngExpression, zoom: number) {
  const map = L.map(el).setView(center, zoom)
  // tile.openstreetmap.org (server chính) hay bị chặn/timeout tuỳ mạng — dùng mirror Đức, cùng dữ liệu OSM, không cần key
  L.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map)
  return map
}

export const pinIcon = L.divIcon({
  className: '',
  html: '<div class="grid size-9 -rotate-45 place-items-center rounded-[999px_999px_999px_0] border-[3px] border-white bg-orange-500 shadow-[0_2px_6px_rgba(0,0,0,0.3)]"><div class="size-2.5 rounded-full bg-white"></div></div>',
  iconSize: [36, 36],
  iconAnchor: [18, 43], // mũi ghim sau khi xoay -45°
})

function locate(ok: (p: { lat: number; lng: number }) => void, fail: (msg: string) => void) {
  navigator.geolocation.getCurrentPosition(
    (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => fail('Không lấy được vị trí hiện tại. Hãy cho phép trình duyệt truy cập vị trí, hoặc nhập địa chỉ.'),
  )
}

/**
 * Tra địa chỉ → toạ độ qua Photon (OSM, miễn phí, không cần API key), gọi thẳng từ trình duyệt
 * nên không dính lý do Nominatim bị chặn IP server — xem CLAUDE.md mục 5.
 * Chỉ tới mức tên đường/địa danh: OSM Việt Nam thiếu dữ liệu số nhà, nên trả nhiều kết quả cho
 * người dùng tự chọn thay vì ghim bừa theo kết quả đầu (địa chỉ không tồn tại vẫn ra match sai).
 */
async function geocode(q: string, near: L.LatLngExpression = VN_CENTER): Promise<Place[]> {
  const c = L.latLng(near)
  const res = await fetch(`https://photon.komoot.io/api/?limit=5&lang=default&lat=${c.lat}&lon=${c.lng}&q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('Không tra được địa chỉ, hãy thử lại hoặc chọn trên bản đồ')
  const data = await res.json()
  const hits: Place[] = (data.features ?? []).map((f: any) => ({
    label: [f.properties.name, f.properties.street, f.properties.district, f.properties.city].filter(Boolean).join(', '),
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }))
  if (!hits.length) throw new Error('Không tìm thấy địa chỉ này, hãy thử viết khác đi (vd chỉ tên đường + tỉnh/thành)')
  return hits
}

function HitList({ hits, onPick, selected }: { hits: Place[]; onPick: (p: Place) => void; selected?: Place | null }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-stone-200 bg-white">
      <div className="border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-500">
        {hits.length} kết quả · chỉ chính xác tới tên đường, chọn đúng kết quả của bạn
      </div>
      <ul>
        {hits.map((h) => {
          const on = selected?.lat === h.lat && selected?.lng === h.lng
          const [head, ...rest] = h.label.split(', ')
          return (
            <li key={`${h.lat},${h.lng}`} className="border-b border-stone-100 last:border-0">
              <button type="button" onClick={() => onPick(h)}
                className={`flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 text-left ${on ? 'bg-teal-50' : 'text-stone-700 hover:bg-stone-50'}`}>
                <Icon name={on ? 'checkCircle' : 'pin'} className={on ? 'text-green-600' : 'text-stone-400'} />
                <span className="flex-1"><b className="font-semibold text-stone-900">{head}</b>{rest.length > 0 && `, ${rest.join(', ')}`}</span>
                {on && <span className="text-sm font-semibold text-teal-800">Đã chọn</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Chọn vị trí của người tìm việc: gõ địa chỉ → chọn trong danh sách kết quả, hoặc GPS. `hero`: bố cục dọc, nút cam (trang chủ). */
export function PlaceSearch({ initial = '', onPick, buttonLabel = 'Tìm', gpsText = true, hero = false }: {
  initial?: string; onPick: (p: Place) => void; buttonLabel?: string; gpsText?: boolean; hero?: boolean
}) {
  const [q, setQ] = useState(initial)
  const [hits, setHits] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function search() {
    setError('')
    setHits(null)
    if (!q.trim()) return setError('Hãy nhập địa chỉ trước khi tìm')
    setBusy(true)
    try {
      setHits(await geocode(q))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function pick(p: Place) {
    setQ(p.label)
    setHits(null)
    onPick(p)
  }

  function gps() {
    setError('')
    setHits(null)
    locate((p) => pick({ label: 'Vị trí hiện tại của bạn', ...p }), setError)
  }

  const input = (
    <label className={`input flex items-center gap-2.5 ${hero ? '' : 'flex-1'}`}>
      <Icon name="pin" className="text-teal-700" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nhập số nhà, tên đường…" aria-label="Địa chỉ"
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
        className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-stone-400" />
      {!gpsText && (
        <button type="button" title="Dùng vị trí hiện tại" onClick={gps} className="-mr-2 grid size-9 cursor-pointer place-items-center rounded-lg text-teal-700 hover:bg-teal-50">
          <Icon name="locate" />
        </button>
      )}
    </label>
  )
  const gpsButton = gpsText && (
    <button type="button" className="btn btn-ghost h-12" onClick={gps}><Icon name="locate" size={18} />Dùng vị trí hiện tại</button>
  )
  const searchButton = (
    <button type="button" onClick={search} disabled={busy} className={`btn h-12 ${hero ? 'btn-primary px-6' : 'btn-secondary'}`}>
      {busy ? <Spinner /> : <Icon name="search" size={18} stroke={2} />}{buttonLabel}
    </button>
  )

  return (
    <div className="relative flex flex-col gap-3">
      {hero
        ? <>{input}<div className="flex items-center justify-between gap-3">{gpsButton}{searchButton}</div></>
        : <div className="flex items-center gap-3">{input}{searchButton}{gpsButton}</div>}
      {hits && <div className="absolute top-full right-0 left-0 z-[1100] mt-1 shadow-lg"><HitList hits={hits} onPick={pick} /></div>}
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

/** Địa chỉ để tra: 3 ô street/ward/city của form đăng tin. */
function readAddress(form: HTMLFormElement): string {
  const val = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? ''
  return [val('street'), val('ward'), val('city')].filter(Boolean).join(', ')
}

/**
 * Bản đồ OSM để bấm/kéo ghim lấy lat/lng cho tin đăng, kèm tra địa chỉ để nhảy ghim tới đúng khu vực.
 * Xuất toạ độ qua 2 input ẩn name="lat"/"lng" để form cha đọc qua FormData.
 */
export function LocationPicker({ initial, invalid }: { initial?: { lat: number; lng: number }; invalid?: boolean }) {
  const mapEl = useRef<HTMLDivElement>(null)
  const mapApi = useRef<{ map: L.Map; setMarker: (lat: number, lng: number) => void }>(undefined)
  const [coords, setCoords] = useState(initial ?? null)
  const [hits, setHits] = useState<Place[] | null>(null)
  const [picked, setPicked] = useState<Place | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const map = createMap(mapEl.current!, coords ? [coords.lat, coords.lng] : VN_CENTER, coords ? 16 : 6)
    let alive = true // GPS có thể trả về sau khi map đã bị gỡ (rời trang, StrictMode mount 2 lần)
    let marker: L.Marker | null = null
    function setMarker(lat: number, lng: number) {
      if (marker) marker.setLatLng([lat, lng])
      else {
        marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map)
          .bindTooltip('Kéo ghim tới đúng cửa nhà', { permanent: true, direction: 'top', offset: [0, -44] })
          .on('dragend', () => {
            const p = marker!.getLatLng()
            setCoords({ lat: p.lat, lng: p.lng })
          })
      }
      setCoords({ lat, lng })
    }
    if (coords) setMarker(coords.lat, coords.lng)
    // Tin mới: thử GPS để zoom gần vị trí thật; từ chối thì giữ view Đà Nẵng, không báo lỗi (khác nút chủ động)
    else locate((p) => { if (alive) { map.setView([p.lat, p.lng], 16); setMarker(p.lat, p.lng) } }, () => {})
    map.on('click', (e) => setMarker(e.latlng.lat, e.latlng.lng))
    mapApi.current = { map, setMarker }
    return () => { alive = false; map.remove() }
    // eslint-disable-next-line -- chỉ tạo map 1 lần lúc mount; đổi initial thì remount qua key ở nơi gọi
  }, [])

  function goTo(p: Place) {
    mapApi.current?.map.setView([p.lat, p.lng], 17)
    mapApi.current?.setMarker(p.lat, p.lng)
    setPicked(p)
  }

  async function search(e: MouseEvent<HTMLButtonElement>) {
    const q = readAddress(e.currentTarget.form!)
    setError('')
    setHits(null)
    if (!q) return setError('Hãy nhập địa chỉ ở trên trước khi định vị')
    setBusy(true)
    try {
      setHits(await geocode(q, mapApi.current!.map.getCenter()))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex flex-col gap-3 rounded-xl border bg-stone-50 p-4 ${invalid && !coords ? 'border-red-200' : 'border-stone-100'}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex-1 font-semibold">Vị trí trên bản đồ</span>
        <button type="button" className="btn btn-secondary h-10 px-3.5" onClick={search} disabled={busy}>
          {busy ? <Spinner /> : <Icon name="map" size={18} />}Định vị trên bản đồ
        </button>
        <button type="button" className="btn btn-ghost h-10 px-3" onClick={() => { setError(''); locate((p) => goTo({ label: 'Vị trí hiện tại', ...p }), setError) }}>
          <Icon name="locate" size={18} />Dùng vị trí hiện tại
        </button>
      </div>
      {hits && <HitList hits={hits} onPick={goTo} selected={picked} />}
      <div className="relative">
        <div ref={mapEl} className="isolate h-[260px] rounded-[10px] border border-stone-200" />
        {!coords && (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center rounded-[10px] bg-stone-50/55">
            <div className="max-w-[360px] rounded-xl border border-dashed border-stone-400 bg-white px-[18px] py-3.5 text-center text-stone-700">
              Chưa ghim vị trí. Bấm <b className="font-semibold">Định vị trên bản đồ</b> hoặc bấm vào bản đồ để đặt ghim.
            </div>
          </div>
        )}
      </div>
      {coords
        ? <div className="text-sm text-stone-700 tabular-nums">Toạ độ đã chọn: <b className="font-semibold">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</b> · kéo ghim để chỉnh</div>
        : invalid && <FieldError>Bạn cần ghim vị trí để người tìm việc biết khoảng cách tới nhà bạn.</FieldError>}
      {error && <FieldError>{error}</FieldError>}
      <input type="hidden" name="lat" value={coords?.lat ?? ''} />
      <input type="hidden" name="lng" value={coords?.lng ?? ''} />
    </div>
  )
}

export function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const map = createMap(el.current!, [lat, lng], 16)
    L.marker([lat, lng], { icon: pinIcon, interactive: false }).addTo(map)
    return () => { map.remove() }
  }, [lat, lng])
  return <div ref={el} className="isolate h-[200px] rounded-xl border border-stone-200" />
}

// ---------- Lịch rảnh ----------

/** Khoảng rảnh chưa qua, gom theo ngày bắt đầu (giờ địa phương): [["2026-09-26", [...]], ...] */
export function upcomingByDay(intervals: Interval[]): [string, Interval[]][] {
  const days = new Map<string, Interval[]>()
  const sorted = [...intervals].sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
  for (const i of sorted) {
    if (new Date(i.end_time) <= new Date()) continue
    const key = dateInput(new Date(i.start_time))
    days.set(key, [...(days.get(key) ?? []), i])
  }
  return [...days]
}

/** Số giờ tính từ 0h của ngày `day` (YYYY-MM-DD) — âm hoặc > 24 nếu khác ngày. */
export const hoursFrom = (day: string, t: string) => (+new Date(t) - +new Date(`${day}T00:00`)) / 3_600_000

/** left/width (%) của khoảng [a, b] giờ trên trục [from, to], cắt phần tràn ra ngoài. */
export function spanStyle(a: number, b: number, from = 6, to = 22) {
  const x = (h: number) => ((Math.min(Math.max(h, from), to) - from) / (to - from)) * 100
  return { left: `${x(a)}%`, width: `${x(b) - x(a)}%` }
}

// ---------- JobCard + giải thích AI ----------

const descWord = (s: number) => (s >= 0.3 ? 'Khớp tốt' : s >= 0.1 ? 'Có liên quan' : 'Ít liên quan')
const travelMins = (rec: Rec) => Math.max(1, Math.round(rec.travel_minutes ?? 0))

function Reasons({ job, rec, cols = 2 }: { job: Job; rec: Rec; cols?: 1 | 2 }) {
  const b = rec.breakdown!
  const tf = b.time_feasibility
  const mins = travelMins(rec)
  const items: [IconName, string, string][] = [
    tf >= 0.999 ? ['checkCircle', 'text-green-600', `Nằm trọn trong giờ rảnh của bạn (đã tính ${mins} phút đi lại)`]
      : tf > 0 ? ['clock', 'text-amber-600', `Trùng một phần giờ rảnh của bạn (${fmtPct(tf)} thời gian, đã tính đi lại)`]
        : ['xCircle', 'text-red-600', 'Ngoài giờ rảnh của bạn'],
    ['pin', 'text-teal-700', `Cách bạn ${fmtNum(job.distance_km ?? 0)} km · ~${mins} phút đi lại`],
    ['file', 'text-teal-700', `${descWord(b.semantic)} ${b.semantic >= 0.3 ? 'với' : 'tới'} mô tả của bạn`],
    ['star', 'text-stone-400', 'Chưa có đánh giá'],
  ]
  return (
    <div className={`grid gap-x-6 gap-y-3 ${cols === 2 ? 'grid-cols-2' : ''}`}>
      {items.map(([icon, cls, text]) => (
        <div key={icon} className={`flex items-start gap-2.5 ${icon === 'star' ? 'text-stone-600' : ''}`}>
          <Icon name={icon} className={`mt-0.5 ${cls}`} /><span>{text}</span>
        </div>
      ))}
    </div>
  )
}

function Breakdown({ job, rec, radius }: { job: Job; rec: Rec; radius?: number }) {
  const b = rec.breakdown!
  const tf = b.time_feasibility
  // Trọng số khớp WEIGHTS trong ai-service/app/scoring.py (thiết kế AI đã khoá 2026-09-30)
  const rows: [string, string, number, string, boolean?][] = [
    ['Mô tả', '35%', b.semantic, `${fmtPct(b.semantic)} · ${descWord(b.semantic)}`],
    ['Giờ rảnh', '35%', tf, tf >= 0.999 ? '100% · Nằm trọn' : tf > 0 ? `${fmtPct(tf)} · Một phần` : '0% · Ngoài giờ rảnh'],
    ['Khoảng cách', '20%', b.geo, `${fmtNum(job.distance_km ?? 0)} km${radius ? ` / bán kính ${radius} km` : ''}`],
    ['Tin cậy', '10%', b.trust, 'Chưa có đánh giá', true],
  ]
  return (
    <div className="flex flex-col gap-3.5 rounded-[10px] border border-stone-200 bg-stone-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold">Cách tính điểm {fmtPct(rec.final_score)}</div>
        <div className="rounded-full border border-stone-200 bg-white px-3 py-1 text-sm text-stone-700">35% mô tả + 35% giờ rảnh + 20% khoảng cách + 10% tin cậy</div>
      </div>
      {rows.map(([label, weight, v, text, muted]) => (
        <div key={label} className="grid grid-cols-[140px_minmax(0,1fr)_190px] items-center gap-4">
          <div>{label} <span className="text-sm text-stone-500">· {weight}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-stone-200">
            <div className={`h-full rounded-full ${muted ? 'bg-stone-400' : 'bg-teal-600'}`} style={{ width: fmtPct(v) }} />
          </div>
          <div className="text-right text-sm text-stone-700">{text}</div>
        </div>
      ))}
    </div>
  )
}

/** Trục 6h–22h của ngày làm: khối teal = giờ rảnh của seeker, khối đậm = giờ làm. */
function DayTimeline({ job, intervals }: { job: Job; intervals: Interval[] }) {
  const day = dateInput(new Date(job.time_start))
  const h = (t: string) => hoursFrom(day, t)
  const free = intervals.map((i) => [h(i.start_time), h(i.end_time)]).filter(([a, b]) => b > 6 && a < 22)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold"><Icon name="calendar" size={18} className="text-teal-700" />{fmtSlot(job.time_start, job.time_end)}</div>
        <div className="flex gap-4 text-sm text-stone-600">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-[3px] border border-teal-300 bg-teal-100" />Giờ rảnh của bạn</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-[3px] bg-stone-800" />Giờ làm</span>
        </div>
      </div>
      <div className="relative h-8 overflow-hidden rounded-lg bg-stone-100">
        {[25, 50, 75].map((p) => <div key={p} className="absolute inset-y-0 w-px bg-stone-200" style={{ left: `${p}%` }} />)}
        {free.map(([a, b]) => <div key={a} className="absolute inset-y-0 bg-teal-100 shadow-[inset_1px_0_0_#5EEAD4,inset_-1px_0_0_#5EEAD4]" style={spanStyle(a, b)} />)}
        <div className="absolute inset-y-[7px] rounded-[5px] bg-stone-800" style={spanStyle(h(job.time_start), h(job.time_end))} />
      </div>
      <div className="flex justify-between text-sm text-stone-500"><span>6h</span><span>10h</span><span>14h</span><span>18h</span><span>22h</span></div>
    </div>
  )
}

/**
 * 3 biến thể: gọn (không có `rec` — trang chủ, tìm việc, xem trước), AI (rec có breakdown),
 * AI dự phòng (rec không có breakdown: không vòng %, không lý do, chỉ khoảng cách).
 */
export function JobCard({ job, rec, intervals = [], radius, onDetail, action, defaultExpanded = false }: {
  job: Job; rec?: Rec; intervals?: Interval[]; radius?: number; onDetail?: () => void; action?: ReactNode; defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const title = onDetail
    ? <button type="button" onClick={onDetail} className="cursor-pointer text-left hover:text-teal-800 hover:underline">{job.title}</button>
    : job.title
  const money = <div><div className="text-xl leading-7 font-semibold">{fmtMoney(job.salary)}</div><div className="text-sm text-stone-500">cả buổi</div></div>

  if (!rec) {
    return (
      <article className="card flex h-full flex-col gap-3.5 p-5 shadow-sm transition-shadow hover:shadow-md">
        <h3 className="text-lg leading-[26px] font-semibold text-pretty">{title}</h3>
        <div className="flex flex-col gap-2 text-stone-600">
          <IconLine icon="pin">{job.ward}, {job.city}{job.distance_km != null && ` · ${fmtNum(job.distance_km)} km`}</IconLine>
          <IconLine icon="clock">{fmtSlot(job.time_start, job.time_end)}</IconLine>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3.5">{money}{action}</div>
      </article>
    )
  }

  const ai = !!rec.breakdown
  return (
    <article className="card flex flex-col gap-5 p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-5">
        {ai ? <ScoreRing value={rec.final_score} /> : (
          <div className="flex size-[84px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-teal-100 bg-teal-50 text-teal-800">
            <Icon name="pin" size={18} className="text-teal-700" />
            <div className="text-lg leading-6 font-bold">{fmtNum(job.distance_km ?? 0)} km</div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1 text-stone-600">
          <h3 className="text-xl leading-7 font-semibold text-pretty text-stone-900">{title}</h3>
          <IconLine icon="pin">{fullAddress(job)}</IconLine>
          {!ai && <IconLine icon="clock">{fmtSlot(job.time_start, job.time_end)}</IconLine>}
        </div>
        <div className="shrink-0 pt-1 text-right">{money}</div>
      </div>
      {ai && <DayTimeline job={job} intervals={intervals} />}
      {ai && <Reasons job={job} rec={rec} />}
      {ai && expanded && <Breakdown job={job} rec={rec} radius={radius} />}
      <div className="flex items-center gap-3 border-t border-stone-100 pt-4">
        {ai ? (
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="btn btn-ghost -ml-3 h-10 px-3">
            {expanded ? 'Ẩn cách tính điểm' : 'Xem cách tính điểm'}
            <Icon name="chevronDown" size={18} stroke={2} className={expanded ? 'rotate-180' : ''} />
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-stone-500"><Icon name="info" size={16} />Chưa có điểm phù hợp khi AI tạm dừng</span>
        )}
        <div className="flex-1" />
        {onDetail && <button type="button" className="btn btn-secondary" onClick={onDetail}>Xem chi tiết</button>}
        {action}
      </div>
    </article>
  )
}

// ---------- S6: chi tiết việc ----------

export type Detail = { job: Job; rec?: Rec }

function Tile({ label, main, sub }: { label: string; main: string; sub: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] border border-stone-100 bg-stone-50 px-4 py-3.5">
      <span className="text-sm text-stone-500">{label}</span>
      <span className="text-lg font-semibold">{main}</span>
      <span className="text-stone-700">{sub}</span>
    </div>
  )
}

export function JobDetailModal({ item, onClose, action }: { item: Detail | null; onClose: () => void; action?: ReactNode }) {
  const job = item?.job
  const rec = item?.rec
  const ended = job ? jobEnded(job) : false
  return (
    <Modal open={!!item} onClose={onClose} className="w-[760px]">
      {job && (
        <div className="flex max-h-[calc(100vh-48px)] flex-col">
          <div className="flex items-start gap-4 border-b border-stone-100 pt-6 pr-6 pb-[18px] pl-7">
            <div className="flex flex-1 flex-col gap-2">
              {ended ? (
                <span className="inline-flex h-7 w-fit items-center gap-1.5 rounded-full border border-stone-200 bg-stone-100 px-3 text-sm font-semibold text-stone-700">
                  <Icon name="lock" size={14} stroke={2.25} />Đã kết thúc
                </span>
              ) : <span className="w-fit"><JobStatusBadge status="open" /></span>}
              <h2 className="text-2xl leading-8 font-semibold">{job.title}</h2>
            </div>
            <button type="button" title="Đóng" onClick={onClose} className="grid size-11 cursor-pointer place-items-center rounded-[10px] text-stone-700 hover:bg-stone-100">
              <Icon name="x" size={22} stroke={2} />
            </button>
          </div>
          <div className="flex flex-col gap-6 overflow-auto px-7 py-6">
            <div className="flex gap-3">
              <Tile label="Thời gian" main={fmtDay(job.time_start)} sub={`${fmtHM(job.time_start)}–${fmtHM(job.time_end)} · ${fmtHours(job.time_start, job.time_end)}`} />
              <Tile label="Tiền công" main={fmtMoney(job.salary)} sub="cho cả buổi" />
              {job.distance_km != null && (
                <Tile label="Khoảng cách" main={`${fmtNum(job.distance_km)} km`} sub={rec?.travel_minutes != null ? `~${travelMins(rec)} phút đi lại` : 'từ vị trí bạn chọn'} />
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              <IconLine icon="pin" className="font-medium">{fullAddress(job)}</IconLine>
              <MiniMap lat={job.lat} lng={job.lng} />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold">Mô tả công việc</h3>
              <p className="leading-[26px] text-pretty whitespace-pre-line text-stone-800">{job.description}</p>
            </div>
            {rec?.breakdown && (
              <div className="flex flex-col gap-4 rounded-xl border border-teal-100 bg-teal-50 p-5">
                <div className="flex items-center gap-4">
                  <ScoreRing value={rec.final_score} />
                  <div className="text-lg font-semibold">Vì sao gợi ý việc này</div>
                </div>
                <Reasons job={job} rec={rec} cols={1} />
                <Breakdown job={job} rec={rec} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-stone-200 px-7 py-4">
            {ended
              ? <div className="flex flex-1 items-center gap-2 text-stone-700"><Icon name="info" className="text-stone-600" />Tin đã kết thúc — không nhận thêm đơn ứng tuyển.</div>
              : <><div className="flex-1" /><button type="button" className="btn btn-plain h-12" onClick={onClose}>Đóng</button></>}
            {action}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ---------- Ứng tuyển (khách → hỏi đăng nhập; employer/admin → ẩn) ----------

/** Nút Ứng tuyển kèm trạng thái đơn đã có của seeker (đơn đã huỷ thì được ứng tuyển lại). */
export function useApplyButton(enabled = true) {
  const load = useCallback(() => (enabled ? api.myApplications() : Promise.resolve([])), [enabled])
  const { data: apps, reload } = useLoad(load)
  return (job: Job, className?: string) => (
    <ApplyButton job={job} className={className} onApplied={reload}
      status={apps?.find((a) => a.job.id === job.id && a.status !== 'cancelled')?.status} />
  )
}

function ApplyButton({ job, status, onApplied, className = '' }: {
  job: Job; status?: ApplicationStatus; onApplied?: () => void; className?: string
}) {
  const { user } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [askLogin, setAskLogin] = useState(false)

  if (user && user.role !== 'job_seeker') return null
  const shown = status ?? (state === 'done' ? 'pending' : undefined)
  if (shown === 'pending') {
    return (
      <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 font-semibold text-amber-800">
        <Icon name="hourglass" size={18} className="text-amber-700" />Đã ứng tuyển · Chờ duyệt
      </span>
    )
  }
  if (shown) return <AppStatusBadge status={shown} />

  async function apply() {
    if (!user) return setAskLogin(true)
    setState('busy')
    const track = <>Theo dõi ở <Link to="/seeker/applications" className="font-semibold">Đơn ứng tuyển</Link>.</>
    try {
      await api.apply(job.id)
      setState('done')
      toast({ title: 'Đã gửi đơn ứng tuyển', body: <>Đơn đang chờ người đăng tin duyệt. {track}</> })
    } catch (err) {
      const dup = err instanceof ApiError && err.status === 409
      setState(dup ? 'done' : 'idle')
      toast({ error: true, title: dup ? 'Bạn đã ứng tuyển việc này' : (err as Error).message, body: dup ? track : undefined })
    }
    onApplied?.()
  }

  const next = encodeURIComponent(location.pathname + location.search)
  return (
    <>
      <button type="button" className={`btn btn-primary ${className}`} disabled={jobEnded(job) || state === 'busy'} onClick={apply}>
        {state === 'busy' ? <><Spinner />Đang gửi…</> : 'Ứng tuyển'}
      </button>
      <Modal open={askLogin} onClose={() => setAskLogin(false)} className="w-[460px]">
        <ModalHeader title="Đăng nhập để ứng tuyển" onClose={() => setAskLogin(false)} />
        <div className="flex flex-col gap-4 px-7 pt-3 pb-7">
          <p className="text-stone-700">Bạn đang ứng tuyển <b className="font-semibold">{job.title}</b>. Sau khi đăng nhập, bạn quay lại đúng trang này.</p>
          <div className="mt-1 flex flex-col gap-2.5">
            <Link to={`/login?next=${next}`} className="btn btn-primary h-12">Đăng nhập</Link>
            <Link to="/register" className="btn btn-secondary h-12">Tạo tài khoản mới</Link>
          </div>
        </div>
      </Modal>
    </>
  )
}
