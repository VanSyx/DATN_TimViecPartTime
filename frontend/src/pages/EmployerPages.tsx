import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Application, type Job, type JobInput } from '../api'
import { useAuth } from '../auth'
import { canRate, JobCard, LocationPicker, RatingModal, RatingNotes } from '../job-ui'
import {
  AppStatusBadge, Banner, ConfirmModal, dateInput, EmptyState, FieldError, fmtHM, fmtMoney, fmtNum, fmtRating, fmtSlot, fmtStamp, fullAddress, hm,
  Icon, IconLine, jobEnded, JobStatusBadge, Spinner, toIso, useLoad, useToast,
} from '../ui'

// ---------- S9: Tin đã đăng ----------

function jobNote(job: Job) {
  if (job.status === 'pending_approval') return 'Tin đang chờ quản trị viên duyệt trước khi hiện cho người tìm việc.'
  if (job.status === 'rejected') return 'Tin bị quản trị viên gỡ vì vi phạm quy định — không còn hiện với người tìm việc.'
  if (job.status === 'open' && jobEnded(job)) return 'Đã qua giờ làm — tin không còn hiện với người tìm việc.'
  return null
}

export function EmployerJobsPage() {
  const toast = useToast()
  const { data: jobs, error, reload } = useLoad(api.myJobs)
  const [closing, setClosing] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false)

  function confirmClose() {
    if (!closing) return
    setBusy(true)
    api.closeJob(closing.id)
      .then(() => { toast({ title: 'Đã đóng tin', body: closing.title }); reload() }, (err: Error) => toast({ error: true, title: err.message }))
      .finally(() => { setBusy(false); setClosing(null) })
  }

  return (
    <main className="page">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="h1">Tin đã đăng</h1>
          <p className="text-stone-500">Mỗi tin là một buổi làm. Bấm “Xem đơn” để chọn người.</p>
        </div>
        <Link to="/employer/new" className="btn btn-primary h-[52px] px-6 text-lg shadow-sm"><Icon name="plus" stroke={2.25} />Đăng tin mới</Link>
      </div>
      {error && <Banner tone="error" title="Không tải được danh sách tin">{error}</Banner>}
      {!jobs && !error && <p className="text-stone-500">Đang tải…</p>}
      {jobs?.length === 0 && (
        <EmptyState icon="calendarPlus" title="Bạn chưa đăng tin nào"
          actions={<Link to="/employer/new" className="btn btn-primary h-[52px] px-6 text-lg">Đăng tin đầu tiên</Link>}>
          Đăng một buổi làm với giờ, địa chỉ và tiền công. Người ở gần, hợp giờ sẽ thấy tin của bạn.
        </EmptyState>
      )}
      <div className="flex flex-col gap-3.5">
        {jobs?.map((job) => (
          <article key={job.id} className="card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4 px-6 py-5">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl leading-7 font-semibold">{job.title}</h3>
                <JobStatusBadge status={job.status} />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-stone-600">
                <IconLine icon="clock">{fmtSlot(job.time_start, job.time_end)}</IconLine>
                <IconLine icon="pin">{fullAddress(job)}</IconLine>
                <span className="font-semibold text-stone-900">{fmtMoney(job.salary)}</span>
              </div>
              {jobNote(job) && <div className="text-sm text-stone-600">{jobNote(job)}</div>}
            </div>
            <div className="flex items-center gap-2">
              {job.status === 'open' && <button type="button" className="btn px-3.5 text-red-700 hover:not-disabled:bg-red-50" onClick={() => setClosing(job)}>Đóng tin</button>}
              {job.status !== 'closed' && <Link to={`/employer/jobs/${job.id}/edit`} className="btn btn-neutral px-4"><Icon name="pencil" size={16} />Sửa</Link>}
              <Link to={`/employer/jobs/${job.id}`} className="btn btn-secondary">Xem đơn</Link>
            </div>
          </article>
        ))}
      </div>

      <ConfirmModal open={!!closing} title="Đóng tin này?" keep="Giữ tin" confirm="Đóng tin" busy={busy} onConfirm={confirmClose} onClose={() => setClosing(null)}>
        Tin “{closing?.title}” sẽ không nhận thêm đơn và không hiện với người tìm việc nữa. Các đơn đã có vẫn được giữ lại.
      </ConfirmModal>
    </main>
  )
}

// ---------- S10: Đăng / sửa tin ----------

export function JobFormPage() {
  const { id } = useParams()
  const [job, setJob] = useState<Job | null | undefined>(id ? undefined : null)
  useEffect(() => {
    if (id) api.myJobs().then((js) => setJob(js.find((j) => j.id === id) ?? null), () => setJob(null))
  }, [id])

  if (job === undefined) return <p className="page text-stone-500">Đang tải…</p>
  if (id && !job) {
    return <main className="page"><EmptyState icon="file" title="Không tìm thấy tin" actions={<Link to="/employer" className="btn btn-secondary">← Tin đã đăng</Link>} /></main>
  }
  return <JobForm key={job?.id ?? 'new'} job={job} />
}

function Step({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="card flex scroll-mt-6 flex-col gap-[18px] p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-teal-700 font-bold text-white">{n}</span>
        <h2 className="text-xl leading-7 font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

const DRAFT_KEYS = ['title', 'ward', 'city', 'date', 'start', 'end', 'salary'] as const
type Draft = Record<(typeof DRAFT_KEYS)[number], string>

function JobForm({ job }: { job: Job | null }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(() => ({
    title: job?.title ?? '', ward: job?.ward ?? '', city: job?.city ?? '',
    date: job ? dateInput(new Date(job.time_start)) : '',
    start: job ? fmtHM(job.time_start) : '08:00', end: job ? fmtHM(job.time_end) : '11:00',
    salary: job ? String(job.salary) : '',
  }))
  const [invalid, setInvalid] = useState<'pin' | 'time' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const { date, start, end } = draft
  const timeMsg = start && end && end <= start
    ? `Giờ kết thúc phải sau giờ bắt đầu (${start}). Một tin chỉ gồm một khung giờ trong cùng ngày.`
    : date && start && end && new Date(`${date}T${end}`) <= new Date()
      ? 'Buổi làm này đã qua — hãy chọn ngày giờ trong tương lai.'
      : null
  const shownInvalid = invalid === 'time' && !timeMsg ? null : invalid
  const when = date && start && end
  const preview = {
    ...job, title: draft.title || 'Tiêu đề công việc', ward: draft.ward || 'Phường/xã', city: draft.city || 'Tỉnh/thành phố',
    time_start: when ? `${date}T${start}` : '', time_end: when ? `${date}T${end}` : '', salary: Number(draft.salary) || 0, distance_km: null,
  } as Job

  function onInput(e: FormEvent<HTMLFormElement>) {
    const f = new FormData(e.currentTarget)
    setDraft(Object.fromEntries(DRAFT_KEYS.map((k) => [k, String(f.get(k) ?? '')])) as Draft)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const problem = !f.get('lat') ? 'pin' : timeMsg ? 'time' : null
    setInvalid(problem)
    setError('')
    if (problem) {
      document.getElementById(problem === 'pin' ? 'muc-2' : 'muc-3')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    const text = (k: string) => String(f.get(k)).trim()
    const data: JobInput = {
      title: text('title'), description: text('description'), street: text('street'), ward: text('ward'), city: text('city'),
      lat: Number(f.get('lat')), lng: Number(f.get('lng')), time_start: toIso(date, start), time_end: toIso(date, end), salary: Number(f.get('salary')),
    }
    setBusy(true)
    try {
      await (job ? api.updateJob(job.id, data) : api.createJob(data))
      toast({ title: job ? 'Đã lưu thay đổi' : 'Đã đăng tin', body: data.title })
      navigate('/employer')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <div className="flex flex-col gap-1.5">
        <Link to="/employer" className="text-sm font-semibold no-underline">← Tin đã đăng</Link>
        <h1 className="h1">{job ? 'Sửa tin' : 'Đăng tin mới'}</h1>
        <p className="text-stone-500">Một tin là một khung giờ liền trong một ngày. Tiền công tính cho cả buổi.</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-7">
        <form className="flex min-w-0 flex-col gap-5" onSubmit={onSubmit} onInput={onInput}>
          {shownInvalid && (
            <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-red-900">
              <Icon name="alert" size={22} className="text-red-600" />
              <span className="flex-1"><b className="font-semibold">Còn 1 mục cần sửa trước khi đăng:</b> {shownInvalid === 'pin' ? 'chưa ghim vị trí trên bản đồ (mục 2).' : 'giờ làm chưa hợp lệ (mục 3).'}</span>
              <a href={shownInvalid === 'pin' ? '#muc-2' : '#muc-3'} className="font-semibold text-red-700">Tới mục đó</a>
            </div>
          )}

          <Step n={1} id="muc-1" title="Công việc">
            <label className="field"><span className="label">Tiêu đề</span>
              <input name="title" className="input" required minLength={3} maxLength={200} defaultValue={job?.title} placeholder="VD: Dọn dẹp nhà cửa sáng thứ 7" /></label>
            <label className="field"><span className="label">Mô tả công việc</span>
              <textarea name="description" className="input h-auto min-h-[120px] py-3 leading-6" required maxLength={5000} defaultValue={job?.description}
                placeholder="Việc cần làm, dụng cụ có sẵn, điều cần lưu ý…" />
              <span className="text-sm text-stone-500">AI dùng mô tả này để so khớp với người tìm việc — ghi rõ việc cần làm.</span></label>
          </Step>

          <Step n={2} id="muc-2" title="Địa điểm">
            <label className="field"><span className="label">Số nhà + đường</span>
              <input name="street" className="input" required minLength={2} maxLength={200} defaultValue={job?.street} placeholder="06 Phan Huy Ôn" /></label>
            <div className="grid grid-cols-2 gap-4">
              <label className="field"><span className="label">Phường / xã</span>
                <input name="ward" className="input" required minLength={2} maxLength={100} defaultValue={job?.ward} placeholder="Phường Hải Châu" /></label>
              <label className="field"><span className="label">Tỉnh / thành phố</span>
                <input name="city" className="input" required minLength={2} maxLength={100} defaultValue={job?.city} placeholder="Đà Nẵng" /></label>
            </div>
            <LocationPicker initial={job ? { lat: job.lat, lng: job.lng } : undefined} invalid={invalid === 'pin'} />
          </Step>

          <Step n={3} id="muc-3" title="Thời gian & tiền công">
            <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4">
              <label className="field"><span className="label">Ngày</span>
                <input name="date" type="date" className="input" required defaultValue={date} min={job ? undefined : dateInput(new Date())} /></label>
              <label className="field"><span className="label">Giờ bắt đầu</span>
                <input name="start" type="time" className="input text-lg font-semibold tabular-nums" required defaultValue={start} /></label>
              <label className="field"><span className="label">Giờ kết thúc</span>
                <input name="end" type="time" className="input text-lg font-semibold tabular-nums" required defaultValue={end} aria-invalid={!!timeMsg} /></label>
            </div>
            {timeMsg ? <FieldError>{timeMsg}</FieldError> : start && end && (
              <div className="flex items-center gap-2 text-sm text-teal-800"><Icon name="clock" size={16} stroke={2} className="text-teal-700" />Buổi làm dài {fmtNum(hm(end) - hm(start), 1)} giờ</div>
            )}
            <label className="field max-w-[320px]"><span className="label">Tiền công cả buổi</span>
              <span className="input flex items-center gap-2">
                <input name="salary" type="number" min={0} step={1000} required defaultValue={job?.salary} placeholder="250000"
                  className="h-full min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums outline-none" />
                <span className="text-stone-500">đ</span>
              </span>
              <span className="text-sm text-stone-500">Tính cho cả buổi, không theo giờ.</span></label>
          </Step>

          {error && <Banner tone="error" title="Chưa lưu được tin">{error}</Banner>}
          <div className="flex justify-end gap-3">
            <Link to="/employer" className="btn btn-plain h-[52px] px-5">Huỷ</Link>
            <button className="btn btn-primary h-[52px] px-7 text-lg" disabled={busy}>{busy && <Spinner />}{job ? 'Lưu thay đổi' : 'Đăng tin'}</button>
          </div>
        </form>

        <aside className="sticky top-6 flex flex-col gap-3">
          <div className="flex items-baseline justify-between"><span className="font-semibold">Xem trước</span><span className="text-sm text-stone-500">Người tìm việc sẽ thấy thế này</span></div>
          <JobCard job={preview} action={<span aria-hidden="true" className="btn btn-primary pointer-events-none h-10">Ứng tuyển</span>} />
          <div className="rounded-xl bg-teal-50 px-4 py-3.5 text-sm leading-5 text-teal-800">
            Người tìm việc có hồ sơ còn thấy thêm điểm phù hợp và lý do gợi ý, dựa trên giờ rảnh và khoảng cách của họ.
          </div>
        </aside>
      </div>
    </main>
  )
}

// ---------- S11: Đơn ứng tuyển của 1 tin ----------

export function JobApplicantsPage() {
  const { id } = useParams()
  const toast = useToast()
  const [job, setJob] = useState<Job | null | undefined>(undefined)
  const load = useCallback(() => api.jobApplications(id!), [id])
  const { data: apps, error, reload } = useLoad(load)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rating, setRating] = useState<Application | null>(null)
  const me = useAuth().user!.id

  useEffect(() => {
    api.myJobs().then((js) => setJob(js.find((j) => j.id === id) ?? null), () => setJob(null))
  }, [id])

  function decide(a: Application, status: 'accepted' | 'rejected') {
    setBusyId(a.id)
    api.setApplicationStatus(a.id, status)
      .then(() => {
        reload()
        toast(status === 'accepted'
          ? { title: `Đã nhận ${a.job_seeker.email}`, body: 'Người ứng tuyển sẽ thấy trạng thái “Đã nhận”.' }
          : { title: `Đã từ chối ${a.job_seeker.email}` })
      }, (err: Error) => toast({ error: true, title: err.message }))
      .finally(() => setBusyId(null))
  }

  return (
    <main className="page max-w-[960px] gap-5 pt-7">
      <Link to="/employer" className="text-sm font-semibold no-underline">← Tin đã đăng</Link>
      {job && (
        <section className="card flex items-center gap-6 px-6 py-5">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl leading-8 font-semibold">{job.title}</h1><JobStatusBadge status={job.status} /></div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-stone-600">
              <span>{fmtSlot(job.time_start, job.time_end)}</span><span>{fullAddress(job)}</span><b className="font-semibold text-stone-900">{fmtMoney(job.salary)}</b>
            </div>
          </div>
          {job.status !== 'closed' && <Link to={`/employer/jobs/${job.id}/edit`} className="btn btn-neutral">Sửa tin</Link>}
        </section>
      )}
      <h2 className="mt-2 text-xl leading-7 font-semibold">Người ứng tuyển</h2>
      {error && <Banner tone="error" title="Không tải được danh sách đơn">{error}</Banner>}
      {!apps && !error && <p className="text-stone-500">Đang tải…</p>}
      {apps?.length === 0 && (
        <EmptyState icon="userCheck" title="Chưa có ai ứng tuyển">
          {job && `Người tìm việc ở gần và rảnh vào ${fmtSlot(job.time_start, job.time_end)} sẽ thấy tin này trong gợi ý của họ.`}
        </EmptyState>
      )}
      {!!apps?.length && (
        <div className="card overflow-hidden">
          {apps.map((a) => {
            const phone = a.job_seeker.phone
            const faded = a.status === 'rejected' || a.status === 'cancelled'
            return (
              <div key={a.id} className={`grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border-b border-stone-100 px-6 py-[18px] last:border-0 ${a.status === 'accepted' ? 'bg-green-50/40' : ''}`}>
                <span className={`grid size-12 place-items-center rounded-full text-xl font-bold ${faded ? 'bg-stone-100 text-stone-500' : 'bg-teal-100 text-teal-800'}`}>
                  {a.job_seeker.email[0].toUpperCase()}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <a href={`mailto:${a.job_seeker.email}`} className="truncate text-lg font-semibold text-stone-900 no-underline hover:underline">{a.job_seeker.email}</a>
                    <AppStatusBadge status={a.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-stone-600">
                    {phone
                      ? <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 font-semibold no-underline"><Icon name="phone" size={16} />{phone}</a>
                      : <span className="text-stone-500">Chưa có số điện thoại</span>}
                    <span className="text-stone-500">Ứng tuyển {fmtStamp(a.created_at)}</span>
                    <span className="flex items-center gap-1.5 text-stone-600">
                      <Icon name="star" size={16} className={a.job_seeker.rating_count ? 'text-amber-500' : 'text-stone-400'} />{fmtRating(a.job_seeker.rating_avg, a.job_seeker.rating_count)}
                    </span>
                  </div>
                  {a.status === 'accepted' && new Date(a.job.time_end) > new Date() && (
                    <div className="text-sm text-green-700">{phone ? 'Hãy gọi để hẹn giờ và chỉ đường tới nhà.' : 'Hãy gửi email để hẹn giờ và chỉ đường tới nhà.'}</div>
                  )}
                  <RatingNotes app={a} me={me} other="Người làm" />
                </div>
                <div className="flex gap-2">
                  {canRate(a, me) ? (
                    <button type="button" className="btn btn-primary px-5" onClick={() => setRating(a)}><Icon name="star" size={18} />Đánh giá</button>
                  ) : a.status === 'pending' ? (
                    <>
                      <button type="button" className="btn btn-danger" disabled={busyId === a.id} onClick={() => decide(a, 'rejected')}>Từ chối</button>
                      <button type="button" className="btn btn-teal px-5" disabled={busyId === a.id} onClick={() => decide(a, 'accepted')}>
                        {busyId === a.id ? <Spinner /> : <Icon name="check" size={18} stroke={2.25} />}Nhận
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-stone-500">{a.status === 'cancelled' ? 'Người ứng tuyển đã hủy' : `Đã xử lý ${fmtStamp(a.updated_at)}`}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <RatingModal app={rating} target={rating?.job_seeker.email ?? ''} onClose={() => setRating(null)}
        onSaved={() => { toast({ title: 'Đã gửi đánh giá', body: rating?.job_seeker.email }); setRating(null); reload() }} />
    </main>
  )
}
