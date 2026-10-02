import L from 'leaflet'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Application, type ApplicationStatus, type Interval, type Job, type Recommendations } from '../api'
import { useAuth } from '../auth'
import {
  canRate, createMap, hoursFrom, JobCard, JobDetailModal, PlaceSearch, RatingModal, RatingNotes, spanStyle, upcomingByDay, useApplyButton, VN_CENTER,
  type Detail, type Place,
} from '../job-ui'
import {
  AppStatusBadge, Banner, CardSkeleton, ConfirmModal, dateInput, EmptyState, FieldError, fmtDay, fmtHM, fmtMoney, fmtNum, fmtSlot, hm,
  Icon, IconLine, Modal, ModalHeader, Segmented, Spinner, toIso, useLoad, useSubmit, useToast,
} from '../ui'

const RADII: [number, string][] = [[2, '2 km'], [5, '5 km'], [10, '10 km']]

function DayLabel({ day }: { day: string }) {
  const [weekday, dm] = fmtDay(`${day}T00:00`).split(', ')
  return <div className="leading-5"><div className="font-semibold">{weekday}</div><div className="text-sm text-stone-500">{dm}</div></div>
}

// ---------- S4: Gợi ý cho tôi ----------

type Saved = Place & { radius: number }

export function RecommendPage() {
  const { user } = useAuth()
  // Vị trí đã chọn nhớ theo từng tài khoản trên trình duyệt này: chỉ chọn 1 lần, lần sau thu gọn thành 1 dòng
  const key = `reco_place:${user!.id}`
  const [saved, setSaved] = useState<Saved | null>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null }
  })
  const [editing, setEditing] = useState(!saved)
  const [draftPlace, setDraftPlace] = useState<Place | null>(saved)
  const [draftRadius, setDraftRadius] = useState(saved?.radius ?? 5)
  const [result, setResult] = useState<Recommendations | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hideNudge, setHideNudge] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const { data: me } = useLoad(api.me)
  const { data: intervals } = useLoad(api.availability)
  const applyButton = useApplyButton()

  const load = useCallback((s: Saved) => {
    setLoading(true)
    setError('')
    api.recommendations({ lat: String(s.lat), lng: String(s.lng), radius_km: String(s.radius) })
      .then(setResult, (err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { if (saved) load(saved) }, [saved, load])

  function commit(s: Saved) {
    try { localStorage.setItem(key, JSON.stringify(s)) } catch { /* private mode: chỉ mất phần "nhớ", vẫn gợi ý được */ }
    setSaved(s)
    setDraftPlace(s)
    setDraftRadius(s.radius)
    setEditing(false)
  }

  const upcoming = intervals ? upcomingByDay(intervals) : null
  // Thiếu mô tả → semantic = 0; không có lịch rảnh sắp tới → time_feasibility = 0 với mọi job
  const missing = [
    upcoming && !upcoming.length && ['lịch rảnh sắp tới', 'Thêm giờ rảnh cho các ngày tới để AI gợi ý được việc hợp giờ.'],
    me && !me.description?.trim() && ['mô tả bản thân', 'Viết vài câu về bản thân để AI so khớp với mô tả công việc.'],
  ].filter((m): m is string[] => !!m)
  const fallback = result?.source === 'fallback'

  return (
    <main className="page">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="h1">Gợi ý cho tôi</h1>
          <p className="text-stone-500">Việc hợp giờ rảnh, gần chỗ bạn — kèm lý do cho từng gợi ý.</p>
        </div>
        {saved && !editing && (
          <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white py-1.5 pr-1.5 pl-4">
            <Icon name="pin" className="text-teal-700" />
            <span className="max-w-[420px] truncate font-medium">{saved.label}</span>
            <span className="text-stone-300">|</span>
            <span className="text-stone-600">Bán kính {saved.radius} km</span>
            <button type="button" className="btn btn-neutral h-10 px-3.5" onClick={() => setEditing(true)}>Đổi</button>
          </div>
        )}
      </div>

      {editing && (
        <section className="card flex flex-col gap-[18px] p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl leading-7 font-semibold">Bạn muốn tìm việc quanh đâu?</h2>
            <p className="text-stone-500">Chỉ cần chọn một lần. Lần sau vị trí thu gọn thành một dòng ở góc trên.</p>
          </div>
          <PlaceSearch initial={draftPlace?.label} onPick={setDraftPlace} buttonLabel="Tìm địa chỉ" />
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold">Bán kính</span>
            <Segmented label="Bán kính" value={draftRadius} onChange={setDraftRadius} options={RADII} />
            <div className="flex-1" />
            {saved && <button type="button" className="btn btn-plain h-12" onClick={() => setEditing(false)}>Huỷ</button>}
            <button type="button" className="btn btn-primary h-12 px-6" disabled={!draftPlace} onClick={() => draftPlace && commit({ ...draftPlace, radius: draftRadius })}>
              Xem gợi ý
            </button>
          </div>
        </section>
      )}

      {missing.length > 0 && !hideNudge && (
        <Banner icon="calendarPlus" title={`Bạn chưa khai ${missing.map((m) => m[0]).join(' và ')}`}
          action={<>
            <Link to="/seeker/profile" className="btn btn-secondary">Cập nhật hồ sơ</Link>
            <button type="button" title="Ẩn" onClick={() => setHideNudge(true)} className="grid size-10 cursor-pointer place-items-center rounded-[10px] text-stone-600 hover:bg-sky-100"><Icon name="x" size={18} stroke={2} /></button>
          </>}>
          {missing.map((m) => m[1]).join(' ')}
        </Banner>
      )}

      {fallback && (
        <Banner tone="warn" icon="cloudOff" title="AI tạm thời không phản hồi — đang xếp theo khoảng cách"
          action={<button type="button" className="btn border border-stone-300 bg-white text-stone-900 hover:bg-stone-100" onClick={() => saved && load(saved)}>Thử lại</button>}>
          Điểm phù hợp và lý do gợi ý sẽ hiện lại khi AI hoạt động bình thường.
        </Banner>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-7">
        <div className="flex min-w-0 flex-col gap-4">
          {!saved ? (
            <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center text-stone-500">Chọn một địa chỉ ở trên để xem việc phù hợp quanh bạn.</div>
          ) : loading ? (
            <>
              <div className="flex items-center gap-2.5 text-stone-600"><span className="text-teal-600"><Spinner /></span>Đang tìm việc hợp với giờ rảnh của bạn…</div>
              {[1, 2].map((i) => (
                <div key={i} className="card flex flex-col gap-5 p-6">
                  <div className="flex items-start gap-5">
                    <div className="mx-1.5 size-[72px] shrink-0 rounded-full bg-stone-100" />
                    <div className="flex flex-1 flex-col gap-2.5 pt-1.5"><div className="h-5 w-3/5 rounded-md bg-stone-200" /><div className="h-4 w-2/5 rounded-md bg-stone-100" /></div>
                  </div>
                  <div className="h-8 rounded-lg bg-stone-100" />
                  <div className="grid grid-cols-2 gap-3"><div className="h-4 rounded-md bg-stone-100" /><div className="h-4 rounded-md bg-stone-100" /></div>
                </div>
              ))}
            </>
          ) : error ? (
            <Banner tone="error" title="Không tải được gợi ý" action={<button type="button" className="btn btn-neutral" onClick={() => load(saved)}>Thử lại</button>}>{error}</Banner>
          ) : result && result.items.length === 0 ? (
            <EmptyState icon="search" title={`Chưa có việc nào trong bán kính ${saved.radius} km`}
              actions={<>
                {saved.radius < 10 && <button type="button" className="btn btn-secondary" onClick={() => commit({ ...saved, radius: 10 })}>Mở rộng lên 10 km</button>}
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>Đổi vị trí</button>
              </>}>
              Thử mở rộng bán kính hoặc đổi sang vị trí khác. Khai thêm giờ rảnh cũng giúp bạn thấy nhiều việc hơn.
            </EmptyState>
          ) : result && (
            <>
              <div className="text-stone-600">
                <b className="font-semibold text-stone-900">{result.items.length} việc</b> trong bán kính {saved.radius} km · {fallback ? 'xếp theo khoảng cách, gần nhất trước' : 'xếp theo mức phù hợp'}
              </div>
              {result.items.map((rec, i) => (
                <JobCard key={rec.job.id} job={rec.job} rec={rec} intervals={intervals ?? []} radius={saved.radius} defaultExpanded={i === 0 && !fallback}
                  onDetail={() => setDetail({ job: rec.job, rec })} action={applyButton(rec.job)} />
              ))}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <section className="card flex flex-col gap-3.5 p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Lịch rảnh sắp tới</h2><Link to="/seeker/profile" className="font-semibold no-underline">Sửa</Link></div>
            {upcoming?.length ? (
              <>
                <div className="flex justify-between pl-[68px] text-sm text-stone-400"><span>6h</span><span>14h</span><span>22h</span></div>
                {upcoming.slice(0, 5).map(([day, items]) => (
                  <div key={day} className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-3 text-sm">
                    <DayLabel day={day} />
                    <div className="flex flex-col gap-1">
                      <div className="relative h-4 overflow-hidden rounded-[5px] bg-stone-100">
                        {items.map((i) => <div key={i.id} className="absolute inset-y-0 rounded bg-teal-300" style={spanStyle(hoursFrom(day, i.start_time), hoursFrom(day, i.end_time))} />)}
                      </div>
                      <div className="text-stone-700 tabular-nums">{items.map((i) => `${fmtHM(i.start_time)}–${fmtHM(i.end_time)}`).join(', ')}</div>
                    </div>
                  </div>
                ))}
              </>
            ) : upcoming && <p className="text-stone-500">Chưa có khoảng rảnh sắp tới.</p>}
          </section>
          <section className="card flex flex-col gap-2.5 p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Mô tả của bạn</h2><Link to="/seeker/profile" className="font-semibold no-underline">Sửa</Link></div>
            {me && <p className={`text-pretty ${me.description?.trim() ? 'text-stone-700' : 'text-stone-500'}`}>{me.description?.trim() || 'Chưa có mô tả.'}</p>}
          </section>
        </aside>
      </div>

      <JobDetailModal item={detail} onClose={() => setDetail(null)} action={detail && applyButton(detail.job, 'h-12 px-7')} />
    </main>
  )
}

// ---------- S5: Tìm việc (khách cũng xem được) ----------

const meIcon = L.divIcon({
  className: '', iconSize: [0, 0],
  html: '<div class="size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-sky-600 shadow-[0_0_0_8px_rgba(2,132,199,0.18)]"></div>',
})
const wageIcon = (job: Job, on: boolean) => L.divIcon({
  className: '', iconSize: [0, 0],
  html: `<div class="w-max -translate-x-1/2 -translate-y-full cursor-pointer rounded-full border-2 px-3 py-1.5 text-sm font-bold shadow-[0_2px_6px_rgba(0,0,0,0.18)] ${on ? 'border-white bg-orange-700 text-white' : 'border-teal-600 bg-white text-teal-800'}">${fmtMoney(job.salary)}</div>`,
})

function JobsMap({ jobs, place, selected, onSelect }: { jobs: Job[]; place: Place | null; selected: string | null; onSelect: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map>(undefined)
  const layer = useRef<L.LayerGroup>(undefined)

  useEffect(() => {
    map.current = createMap(el.current!, VN_CENTER, 6)
    layer.current = L.layerGroup().addTo(map.current)
    return () => { map.current!.remove() }
  }, [])

  useEffect(() => {
    const pts = jobs.map((j) => L.latLng(j.lat, j.lng))
    if (place) pts.push(L.latLng(place.lat, place.lng))
    if (pts.length) map.current!.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 })
  }, [jobs, place?.lat, place?.lng])

  useEffect(() => {
    const g = layer.current!
    g.clearLayers()
    if (place) L.marker([place.lat, place.lng], { icon: meIcon, interactive: false }).bindTooltip('Bạn ở đây', { permanent: true, direction: 'bottom', offset: [0, 10] }).addTo(g)
    for (const j of jobs) {
      L.marker([j.lat, j.lng], { icon: wageIcon(j, j.id === selected), zIndexOffset: j.id === selected ? 1000 : 0 }).on('click', () => onSelect(j.id)).addTo(g)
    }
  }, [jobs, place?.lat, place?.lng, selected, onSelect])

  return <div ref={el} className="isolate size-full" />
}

export function SearchPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  // Bộ lọc nằm trên URL: trang chủ dẫn sang được, F5 không mất, gửi link cho người khác được
  const lat = params.get('lat')
  const lng = params.get('lng')
  const place: Place | null = lat && lng ? { label: params.get('label') ?? 'Vị trí đã chọn', lat: +lat, lng: +lng } : null
  const radius = Number(params.get('r') ?? 5)
  const date = params.get('date') ?? ''
  const from = params.get('from') ?? '06:00'
  const to = params.get('to') ?? '22:00'
  const view = params.get('view') === 'map' ? 'map' : 'list'
  const timeBad = !!date && to <= from
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const applyButton = useApplyButton(user?.role === 'job_seeker')

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (timeBad) return
    let stale = false
    setJobs(null)
    setError('')
    api.searchJobs({
      lat: lat ?? undefined, lng: lng ?? undefined, radius_km: lat ? String(radius) : undefined,
      start: date ? toIso(date, from) : undefined, end: date ? toIso(date, to) : undefined,
    }).then(
      (js) => { if (!stale) setJobs(js) },
      (err: Error) => { if (!stale) { setError(err.message); setJobs([]) } },
    )
    return () => { stale = true }
  }, [lat, lng, radius, date, from, to, timeBad])

  const sel = jobs?.find((j) => j.id === selected)
  const dayText = date ? `${fmtDay(`${date}T00:00`)} · ${from}–${to}` : ''

  return (
    <main className="page gap-5 pt-7">
      <div className="flex items-center justify-between gap-4">
        <h1 className="h1">Tìm việc</h1>
        <Segmented label="Cách xem" value={view} onChange={(v) => set({ view: v === 'map' ? 'map' : null })} options={[['list', 'Danh sách'], ['map', 'Bản đồ']]} />
      </div>

      <div className="card flex flex-col gap-4 px-5 py-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-700">Vị trí</span>
            <PlaceSearch key={place?.label} initial={place?.label} gpsText={false} onPick={(p) => set({ lat: String(p.lat), lng: String(p.lng), label: p.label })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-700">Bán kính</span>
            <Segmented label="Bán kính" value={radius} onChange={(r) => set({ r: String(r) })} options={RADII} />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <label className="flex w-[200px] flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-700">Ngày</span>
            <input type="date" className="input" value={date} min={dateInput(new Date())} onChange={(e) => set({ date: e.target.value })} />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-700">Khung giờ</span>
            <div className="flex items-center gap-2" title={date ? undefined : 'Chọn ngày trước'}>
              <input type="time" aria-label="Từ giờ" className="input w-[140px] tabular-nums" value={from} disabled={!date} aria-invalid={timeBad} onChange={(e) => set({ from: e.target.value })} />
              <span className="text-stone-500">–</span>
              <input type="time" aria-label="Đến giờ" className="input w-[140px] tabular-nums" value={to} disabled={!date} aria-invalid={timeBad} onChange={(e) => set({ to: e.target.value })} />
            </div>
          </div>
          <div className="flex-1 pb-3 text-sm text-stone-500">
            {timeBad ? <FieldError>Giờ kết thúc phải sau giờ bắt đầu.</FieldError>
              : !date ? 'Chọn ngày để lọc theo khung giờ bạn rảnh.'
                : !place ? 'Chưa chọn vị trí nên bán kính chưa áp dụng.' : null}
          </div>
        </div>
      </div>

      {!user && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <Icon name="info" className="text-sky-600" />
          <span className="flex-1">Bạn đang xem với tư cách khách. <b className="font-semibold">Đăng nhập</b> để ứng tuyển và nhận gợi ý theo giờ rảnh.</span>
          <Link to={`/login?next=${encodeURIComponent(`/tim-viec?${params}`)}`} className="font-semibold no-underline">Đăng nhập</Link>
        </div>
      )}

      {error && <Banner tone="error" title="Không tải được danh sách việc">{error}</Banner>}

      {!jobs && !timeBad && (
        <>
          <div className="flex items-center gap-2.5 text-stone-600"><span className="text-teal-600"><Spinner /></span>Đang tìm việc quanh bạn…</div>
          <div className="grid grid-cols-3 gap-5">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        </>
      )}

      {jobs?.length === 0 && !error && (
        <EmptyState icon="search" title={date ? 'Không có việc nào khớp bộ lọc' : place ? `Chưa có việc nào trong bán kính ${radius} km` : 'Chưa có việc nào đang mở'}
          actions={<>
            {date && <button type="button" className="btn btn-secondary" onClick={() => set({ date: null, from: null, to: null })}>Bỏ lọc khung giờ</button>}
            {place && radius < 10 && <button type="button" className="btn btn-ghost" onClick={() => set({ r: '10' })}>Mở rộng lên 10 km</button>}
          </>}>
          {date ? `Chưa có việc trong khung ${dayText}. Thử bỏ khung giờ hoặc mở rộng bán kính.` : 'Thử mở rộng bán kính hoặc đổi sang vị trí khác.'}
        </EmptyState>
      )}

      {!!jobs?.length && (
        <div className="flex items-center gap-3 text-stone-600">
          <span>
            <b className="font-semibold text-stone-900">{jobs.length} việc</b>
            {place ? ` trong bán kính ${radius} km · gần nhất trước` : ' · mới đăng trước'}{dayText && ` · ${dayText}`}
          </span>
          {date && <button type="button" className="btn btn-ghost h-9 px-3" onClick={() => set({ date: null, from: null, to: null })}>Bỏ lọc ngày</button>}
        </div>
      )}

      {!!jobs?.length && view === 'list' && (
        <>
          <div className="grid grid-cols-3 gap-5">
            {jobs.map((job) => <JobCard key={job.id} job={job} onDetail={() => setDetail({ job })} action={applyButton(job, 'h-10')} />)}
          </div>
          <div className="pt-2 text-center text-sm text-stone-500">{place ? 'Đã hiện tất cả việc trong bán kính' : 'Đã hiện các việc mới nhất'}</div>
        </>
      )}

      {!!jobs?.length && view === 'map' && (
        <div className="card grid h-[560px] grid-cols-[360px_minmax(0,1fr)] overflow-hidden">
          <div className="flex flex-col overflow-auto border-r border-stone-200">
            <div className="border-b border-stone-100 px-4 py-3.5 text-sm text-stone-600"><b className="font-semibold text-stone-900">{jobs.length} việc</b> trên bản đồ</div>
            {jobs.map((j) => (
              <button key={j.id} type="button" onClick={() => setSelected(j.id)}
                className={`flex w-full cursor-pointer flex-col gap-1 border-b border-stone-100 px-4 py-3.5 text-left ${j.id === selected ? 'bg-teal-50 shadow-[inset_3px_0_0_#0D9488]' : 'hover:bg-stone-50'}`}>
                <span className="leading-[22px] font-semibold">{j.title}</span>
                <span className="text-sm text-stone-600">{fmtSlot(j.time_start, j.time_end)}</span>
                <span className="flex justify-between gap-2 text-sm">
                  <span className="text-stone-600">{j.distance_km != null ? `cách ${fmtNum(j.distance_km)} km` : `${j.ward}, ${j.city}`}</span>
                  <b className="font-semibold">{fmtMoney(j.salary)}</b>
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <JobsMap jobs={jobs} place={place} selected={selected} onSelect={setSelected} />
            {sel && (
              <div className="card absolute bottom-4 left-1/2 z-[1000] flex w-[340px] -translate-x-1/2 flex-col gap-2 p-4 shadow-[0_10px_30px_rgba(28,25,23,0.22)]">
                <div className="leading-[22px] font-semibold">{sel.title}</div>
                <div className="text-sm text-stone-600">{fmtSlot(sel.time_start, sel.time_end)}{sel.distance_km != null && ` · cách ${fmtNum(sel.distance_km)} km`}</div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <b className="text-lg font-semibold">{fmtMoney(sel.salary)}</b>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn btn-secondary h-10 px-3 text-sm" onClick={() => setDetail({ job: sel })}>Chi tiết</button>
                    {applyButton(sel, 'h-10 px-3.5 text-sm')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <JobDetailModal item={detail} onClose={() => setDetail(null)} action={detail && applyButton(detail.job, 'h-12 px-7')} />
    </main>
  )
}

// ---------- S7: Hồ sơ & lịch rảnh ----------

const QUICK: [string, string, string][] = [['Sáng 7–11', '07:00', '11:00'], ['Chiều 13–17', '13:00', '17:00'], ['Tối 18–21', '18:00', '21:00']]
const GRID_3H = { backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc(12.5% - 1px), #F5F5F4 calc(12.5% - 1px) 12.5%)' }

function AddSlotForm({ day, onClose, onSaved }: { day: string; onClose: () => void; onSaved: (i: Interval) => void }) {
  const [date, setDate] = useState(day)
  const [start, setStart] = useState('07:00')
  const [end, setEnd] = useState('11:00')
  const { error, busy, wrap } = useSubmit()
  const bad = end <= start

  const save = wrap(async () => {
    if (new Date(`${date}T${end}`) <= new Date()) throw new Error('Khoảng rảnh này đã qua, hãy chọn giờ trong tương lai.')
    onSaved(await api.addAvailability(toIso(date, start), toIso(date, end)))
  })

  return (
    <form onSubmit={save}>
      <ModalHeader title="Thêm khoảng rảnh" onClose={onClose} />
      <div className="flex flex-col gap-[18px] px-7 py-5">
        <label className="field">
          <span className="label">Ngày</span>
          <input type="date" required className="input" value={date} min={dateInput(new Date())} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="field">
          <div className="flex items-baseline justify-between"><span className="label">Điền nhanh</span><span className="text-sm text-stone-500">Chỉ điền sẵn giờ, bạn vẫn sửa được</span></div>
          <div className="flex gap-2">
            {QUICK.map(([label, a, b]) => (
              <button key={label} type="button" onClick={() => { setStart(a); setEnd(b) }}
                className="h-10 cursor-pointer rounded-full border border-stone-300 px-4 hover:border-teal-600 hover:bg-teal-50">{label}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="field"><span className="label">Giờ bắt đầu</span>
            <input type="time" required className="input text-lg font-semibold tabular-nums" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="field"><span className="label">Giờ kết thúc</span>
            <input type="time" required className="input text-lg font-semibold tabular-nums" value={end} aria-invalid={bad} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        {bad ? <FieldError>Giờ kết thúc phải sau giờ bắt đầu. Khoảng rảnh qua nửa đêm thì tách thành 2 khoảng.</FieldError> : (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-stone-600">Xem trước ngày {fmtDay(`${date}T00:00`)}</span>
            <div className="relative h-9 rounded-lg border border-stone-200 bg-stone-50">
              <div className="absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-md border border-dashed border-teal-600 bg-teal-100 text-[13px] font-semibold whitespace-nowrap text-teal-900" style={spanStyle(hm(start), hm(end), 0, 24)}>
                {start}–{end}
              </div>
            </div>
            <div className="flex justify-between text-sm text-stone-500"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
          </div>
        )}
        {error && <FieldError>{error}</FieldError>}
      </div>
      <div className="flex justify-end gap-3 border-t border-stone-200 px-7 py-4">
        <button type="button" className="btn btn-plain h-12" onClick={onClose}>Huỷ</button>
        <button className="btn btn-primary h-12 px-6" disabled={busy || bad}>{busy && <Spinner />}Lưu khoảng rảnh</button>
      </div>
    </form>
  )
}

function DescriptionCard({ initial }: { initial: string }) {
  const toast = useToast()
  const [text, setText] = useState(initial)
  const { error, busy, wrap } = useSubmit()
  const save = wrap(async () => {
    await api.updateProfile(text)
    toast({ title: 'Đã lưu mô tả', body: 'Gợi ý sẽ dùng mô tả mới từ lần tải tiếp theo.' })
  })
  return (
    <form onSubmit={save} className="card flex flex-col gap-3 p-5">
      <h2 className="text-lg font-semibold">Mô tả bản thân</h2>
      <textarea className="input h-auto min-h-[132px] py-3 leading-6" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Mô tả bản thân"
        placeholder="VD: Sinh viên năm 2, quen dọn dẹp và nấu ăn đơn giản, không làm buổi tối…" />
      <div className="flex justify-between text-sm text-stone-500"><span>Không cần CV, vài câu là đủ</span><span>{text.length}/2000</span></div>
      <div className="flex flex-col gap-1.5 rounded-[10px] bg-stone-50 px-3.5 py-3 text-sm leading-5 text-stone-700">
        <b className="font-semibold text-stone-900">Gợi ý cách viết</b>
        <span>• Việc bạn làm được: dọn dẹp, trông trẻ, nấu ăn…</span>
        <span>• Kinh nghiệm hoặc điểm mạnh của bạn</span>
        <span>• Điều cần lưu ý: dị ứng, không làm buổi tối…</span>
      </div>
      {error && <FieldError>{error}</FieldError>}
      <button className="btn btn-secondary w-fit" disabled={busy}>{busy && <Spinner />}Lưu mô tả</button>
    </form>
  )
}

export function ProfilePage() {
  const toast = useToast()
  const { data: intervals, error, reload } = useLoad(api.availability)
  const { data: me } = useLoad(api.me)
  const [adding, setAdding] = useState<string | null>(null)
  const days = intervals ? upcomingByDay(intervals) : null

  function remove(i: Interval) {
    api.deleteAvailability(i.id).then(
      () => { reload(); toast({ title: 'Đã xoá khoảng rảnh', body: fmtSlot(i.start_time, i.end_time) }) },
      (err: Error) => toast({ error: true, title: err.message }),
    )
  }

  return (
    <main className="page">
      <div className="flex flex-col gap-1.5">
        <h1 className="h1">Hồ sơ & lịch rảnh</h1>
        <p className="text-stone-500">AI dùng lịch rảnh và mô tả này để gợi ý việc cho bạn.</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6">
        <section className="card flex flex-col gap-[18px] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl leading-7 font-semibold">Lịch rảnh</h2>
              <p className="text-stone-600">Khai theo từng ngày cụ thể, giờ nào cũng được — không cần theo ca.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(dateInput(new Date()))}><Icon name="plus" size={18} stroke={2} />Thêm khoảng rảnh</button>
          </div>
          {error && <FieldError>{error}</FieldError>}
          {days?.length === 0 && (
            <div className="flex items-center gap-7 rounded-xl border border-dashed border-stone-300 px-8 py-9">
              <span className="grid size-28 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700"><Icon name="calendarPlus" size={44} stroke={1.5} /></span>
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xl leading-7 font-semibold">Bạn chưa khai giờ rảnh nào</h3>
                <p className="text-pretty text-stone-600">AI ưu tiên việc nằm trọn trong giờ bạn rảnh. Chưa khai thì mọi việc đều bị tính là ngoài giờ rảnh.</p>
                <ol className="mt-1 flex flex-col gap-2">
                  {['Bấm “Thêm khoảng rảnh” và chọn ngày', 'Chọn giờ bắt đầu và kết thúc (vd 07:15–11:40)', 'Lưu — gợi ý sẽ cập nhật theo lịch mới'].map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5">
                      <span className="grid size-[26px] place-items-center rounded-full bg-orange-50 text-sm font-bold text-orange-700">{i + 1}</span>{s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
          {!!days?.length && (
            <>
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-[84px_minmax(0,1fr)_40px] gap-3">
                  <span />
                  <div className="flex justify-between text-sm text-stone-500 tabular-nums">{[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h}>{h}h</span>)}</div>
                  <span />
                </div>
                {days.map(([day, items]) => (
                  <div key={day} className="grid grid-cols-[84px_minmax(0,1fr)_40px] items-center gap-3">
                    <DayLabel day={day} />
                    <div className="relative h-12 rounded-lg border border-stone-200 bg-stone-50" style={GRID_3H}>
                      {items.map((i) => {
                        const label = `${fmtHM(i.start_time)}–${fmtHM(i.end_time)}`
                        return (
                          <div key={i.id} title={label} style={spanStyle(hoursFrom(day, i.start_time), hoursFrom(day, i.end_time), 0, 24)}
                            className="group absolute inset-y-[5px] flex items-center justify-center overflow-hidden rounded-md border border-teal-300 bg-teal-100 text-sm font-semibold whitespace-nowrap text-teal-900 tabular-nums">
                            <span className="truncate px-1">{label}</span>
                            <button type="button" title={`Xoá khoảng rảnh ${label}`} onClick={() => remove(i)}
                              className="absolute right-1 grid size-6 cursor-pointer place-items-center rounded-full border border-teal-200 bg-white text-red-700 opacity-0 group-hover:opacity-100 focus:opacity-100">
                              <Icon name="x" size={14} stroke={2.25} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    <button type="button" title="Thêm vào ngày này" onClick={() => setAdding(day)} className="grid size-10 cursor-pointer place-items-center rounded-[10px] text-teal-700 hover:bg-teal-50">
                      <Icon name="plus" size={18} stroke={2} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-[10px] bg-teal-50 px-3.5 py-3 text-sm leading-5 text-teal-800">
                <Icon name="info" size={18} className="text-teal-700" />
                Việc nằm trọn trong giờ rảnh (đã tính thời gian đi lại) được điểm giờ rảnh cao nhất, trùng một phần thì được điểm theo tỉ lệ. Rê chuột lên khoảng rảnh để xoá.
              </div>
            </>
          )}
        </section>

        <div className="flex flex-col gap-4">
          {me && <DescriptionCard initial={me.description ?? ''} />}
          {me && (
            <section className="card flex flex-col gap-3 p-5">
              <h2 className="text-lg font-semibold">Liên hệ</h2>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-stone-500">Email</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span>{me.email}</span>
                  <span className={`flex h-[26px] items-center rounded-full border px-2.5 text-[13px] font-semibold ${me.email_verified ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {me.email_verified ? 'Đã xác minh' : 'Chưa xác minh'}
                  </span>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <Modal open={!!adding} onClose={() => setAdding(null)} className="w-[580px]">
        {adding && (
          <AddSlotForm day={adding} onClose={() => setAdding(null)}
            onSaved={(i) => { setAdding(null); reload(); toast({ title: 'Đã lưu lịch rảnh', body: fmtSlot(i.start_time, i.end_time) }) }} />
        )}
      </Modal>
    </main>
  )
}

// ---------- S8: Đơn ứng tuyển ----------

const TABS: [string, string, (s: ApplicationStatus) => boolean][] = [
  ['all', 'Tất cả', () => true],
  ['pending', 'Chờ duyệt', (s) => s === 'pending'],
  ['accepted', 'Đã nhận', (s) => s === 'accepted'],
  ['other', 'Khác', (s) => s === 'rejected' || s === 'cancelled'],
]

const NOTE: Record<ApplicationStatus, (a: Application) => string> = {
  accepted: (a) => new Date(a.job.time_end) <= new Date()
    ? 'Công việc đã kết thúc.'
    : `Người đăng tin đã nhận bạn. Nhớ đến đúng giờ: ${fmtDay(a.job.time_start)} lúc ${fmtHM(a.job.time_start)}.`,
  pending: () => 'Đang chờ người đăng tin xem đơn.',
  rejected: () => 'Đơn không được nhận lần này. Xem thêm việc khác trong Gợi ý cho tôi.',
  cancelled: () => 'Bạn đã hủy đơn này.',
}

export function MyApplicationsPage() {
  const toast = useToast()
  const { data: apps, error, reload } = useLoad(api.myApplications)
  const [tab, setTab] = useState('all')
  const [cancel, setCancel] = useState<Application | null>(null)
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [rating, setRating] = useState<Application | null>(null)
  const me = useAuth().user!.id
  const inTab = TABS.find((t) => t[0] === tab)![2]
  const shown = apps?.filter((a) => inTab(a.status))

  function confirmCancel() {
    if (!cancel) return
    setBusy(true)
    api.setApplicationStatus(cancel.id, 'cancelled')
      .then(() => { toast({ title: 'Đã hủy đơn', body: cancel.job.title }); reload() }, (err: Error) => toast({ error: true, title: err.message }))
      .finally(() => { setBusy(false); setCancel(null) })
  }

  return (
    <main className="page max-w-[880px] gap-5">
      <h1 className="h1">Đơn ứng tuyển của tôi</h1>
      {error && <Banner tone="error" title="Không tải được danh sách đơn">{error}</Banner>}
      {!apps && !error && <p className="text-stone-500">Đang tải…</p>}
      {apps?.length === 0 && (
        <EmptyState icon="file" title="Bạn chưa ứng tuyển việc nào" actions={<Link to="/seeker" className="btn btn-primary">Xem gợi ý cho tôi</Link>}>
          Xem các việc hợp giờ rảnh của bạn và ứng tuyển chỉ với một nút bấm.
        </EmptyState>
      )}
      {!!apps?.length && (
        <>
          <div role="tablist" className="flex gap-1 border-b border-stone-200">
            {TABS.map(([k, label, f]) => {
              const on = k === tab
              return (
                <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setTab(k)}
                  className={`flex h-12 cursor-pointer items-center gap-2 px-4 ${on ? 'font-semibold text-teal-800 shadow-[inset_0_-3px_0_#0D9488]' : 'font-medium text-stone-600 hover:text-stone-900'}`}>
                  {label}
                  <span className={`grid h-6 min-w-6 place-items-center rounded-full px-[7px] text-[13px] font-bold ${on ? 'bg-teal-100 text-teal-800' : 'bg-stone-100 text-stone-600'}`}>
                    {apps.filter((a) => f(a.status)).length}
                  </span>
                </button>
              )
            })}
          </div>
          {shown?.length === 0 && <p className="py-6 text-center text-stone-500">Không có đơn nào ở mục này.</p>}
          {shown?.map((a) => (
            <article key={a.id} className={`card flex flex-col gap-3.5 px-6 py-5 ${a.status === 'rejected' || a.status === 'cancelled' ? 'opacity-85' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <h3 className="text-xl leading-7 font-semibold">{a.job.title}</h3>
                  <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-stone-600">
                    <IconLine icon="clock">{fmtSlot(a.job.time_start, a.job.time_end)}</IconLine>
                    <IconLine icon="pin">{a.job.ward}, {a.job.city}</IconLine>
                    <span className="font-semibold text-stone-900">{fmtMoney(a.job.salary)}</span>
                  </div>
                </div>
                <AppStatusBadge status={a.status} />
              </div>
              <div className="flex items-center gap-3 border-t border-stone-100 pt-3.5">
                <span className={`flex-1 text-sm leading-5 ${a.status === 'accepted' ? 'text-green-700' : 'text-stone-600'}`}>{NOTE[a.status](a)}</span>
                <button type="button" className="btn btn-ghost h-10 px-3.5" onClick={() => setDetail({ job: a.job })}>Xem việc</button>
                {a.status === 'pending' && <button type="button" className="btn btn-danger h-10 px-4" onClick={() => setCancel(a)}>Hủy đơn</button>}
                {canRate(a, me) && <button type="button" className="btn btn-primary h-10 px-4" onClick={() => setRating(a)}><Icon name="star" size={18} />Đánh giá</button>}
              </div>
              <RatingNotes app={a} me={me} other="Người đăng tin" />
            </article>
          ))}
        </>
      )}

      <ConfirmModal open={!!cancel} title="Hủy đơn ứng tuyển?" keep="Giữ đơn" confirm="Hủy đơn" busy={busy} onConfirm={confirmCancel} onClose={() => setCancel(null)}>
        Bạn sẽ rút đơn khỏi “{cancel?.job.title}”. Có thể ứng tuyển lại nếu tin còn mở.
      </ConfirmModal>
      <JobDetailModal item={detail} onClose={() => setDetail(null)} />
      <RatingModal app={rating} target="người đăng tin" onClose={() => setRating(null)}
        onSaved={() => { toast({ title: 'Đã gửi đánh giá', body: rating?.job.title }); setRating(null); reload() }} />
    </main>
  )
}
