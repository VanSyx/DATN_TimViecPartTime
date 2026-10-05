import { useCallback, useState } from 'react'
import { api, roleLabel, type AdminJob, type AdminReport, type AdminUser, type Job } from '../api'
import { JobDetailModal } from '../job-ui'
import {
  Banner, ConfirmModal, EmptyState, fmtMoney, fmtSlot, fmtStamp, fullAddress, Icon, IconLine, jobEnded, JobStatusBadge,
  Segmented, Spinner, useLoad, useToast,
} from '../ui'

// FR10 (wireframe W4). Tin hiện ngay khi đăng nên admin không "duyệt trước" mà gỡ tin vi phạm sau. FR7: xử lý báo cáo.

function AdminTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <h1 className="h1">{title}</h1>
        <span className="flex h-7 items-center rounded-full bg-stone-900 px-3 text-[13px] font-semibold text-white">Quản trị viên</span>
      </div>
      <p className="text-stone-500">{sub}</p>
    </div>
  )
}

// ---------- Tin đăng ----------

const JOB_FILTERS: ['all' | Job['status'], string][] = [['all', 'Tất cả'], ['open', 'Đang mở'], ['rejected', 'Bị gỡ'], ['closed', 'Đã đóng']]

export function AdminJobsPage() {
  const toast = useToast()
  const { data: jobs, error, reload } = useLoad(api.adminJobs)
  const [filter, setFilter] = useState<'all' | Job['status']>('all')
  const [removing, setRemoving] = useState<AdminJob | null>(null)
  const [reason, setReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Job | null>(null)
  const shown = jobs?.filter((j) => filter === 'all' || j.status === filter)

  function setStatus(job: AdminJob, status: 'open' | 'rejected') {
    setBusyId(job.id)
    api.setJobStatus(job.id, status, status === 'rejected' ? reason : undefined)
      .then(() => { toast({ title: status === 'rejected' ? 'Đã gỡ tin' : 'Đã khôi phục tin', body: job.title }); reload() },
        (err: Error) => toast({ error: true, title: err.message }))
      .finally(() => { setBusyId(null); setRemoving(null) })
  }

  return (
    <main className="page gap-5">
      <AdminTitle title="Tin đăng" sub="Tin hiện ngay khi đăng. Gỡ tin vi phạm quy định; tin bị gỡ không còn hiện với người tìm việc và khôi phục được." />
      <Segmented label="Lọc theo trạng thái" options={JOB_FILTERS} value={filter} onChange={setFilter} />
      {error && <Banner tone="error" title="Không tải được danh sách tin">{error}</Banner>}
      {!jobs && !error && <p className="text-stone-500">Đang tải…</p>}
      {shown?.length === 0 && <EmptyState icon="list" title="Không có tin nào ở mục này" />}
      <div className="flex flex-col gap-3.5">
        {shown?.map((job) => (
          <article key={job.id} className="card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 px-6 py-5">
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
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-500">
                <span>Người đăng: <span className="text-stone-700">{job.employer.email}</span>{job.employer.is_blocked && ' (đang bị khoá)'}</span>
                <span>Đăng {fmtStamp(job.created_at)}</span>
                {job.status === 'open' && jobEnded(job) && <span>Đã qua giờ làm</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-neutral px-4" onClick={() => setDetail(job)}><Icon name="eye" size={16} />Xem tin</button>
              {job.status === 'open' && <button type="button" className="btn btn-danger px-4" onClick={() => { setReason(''); setRemoving(job) }}>Gỡ tin</button>}
              {job.status === 'rejected' && (
                <button type="button" className="btn btn-secondary px-4" disabled={busyId === job.id} onClick={() => setStatus(job, 'open')}>
                  {busyId === job.id && <Spinner />}Khôi phục
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <ConfirmModal open={!!removing} title="Gỡ tin này?" keep="Giữ tin" confirm="Gỡ tin" busy={!!busyId}
        onConfirm={() => removing && setStatus(removing, 'rejected')} onClose={() => setRemoving(null)}>
        Tin “{removing?.title}” sẽ không còn hiện với người tìm việc và không nhận thêm đơn. Người đăng vẫn thấy tin với trạng thái “Bị gỡ”. Có thể khôi phục sau.
        <label className="field mt-3.5"><span className="label">Lý do gỡ <span className="font-normal text-stone-500">(gửi kèm thông báo cho người đăng)</span></span>
          <textarea className="input h-auto min-h-[88px] py-3 leading-6" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </ConfirmModal>
      <JobDetailModal item={detail && { job: detail }} onClose={() => setDetail(null)} />
    </main>
  )
}

// ---------- Người dùng ----------

export function AdminUsersPage() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const load = useCallback(() => api.adminUsers(q), [q])
  const { data: users, error, reload } = useLoad(load)
  const [blocking, setBlocking] = useState<AdminUser | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function setBlocked(u: AdminUser, blocked: boolean) {
    setBusyId(u.id)
    api.setBlocked(u.id, blocked)
      .then(() => { toast({ title: blocked ? 'Đã khoá tài khoản' : 'Đã mở khoá tài khoản', body: u.email }); reload() },
        (err: Error) => toast({ error: true, title: err.message }))
      .finally(() => { setBusyId(null); setBlocking(null) })
  }

  return (
    <main className="page gap-5">
      <AdminTitle title="Người dùng" sub="Tài khoản bị khoá không đăng nhập được, bị đăng xuất ngay, và tin họ đăng bị ẩn khỏi người tìm việc." />
      <form className="flex max-w-[560px] gap-2" onSubmit={(e) => { e.preventDefault(); setQ(String(new FormData(e.currentTarget).get('q')).trim()) }}>
        <input name="q" type="search" className="input flex-1" placeholder="Tìm theo email" aria-label="Tìm theo email" defaultValue={q} />
        <button className="btn btn-primary px-5"><Icon name="search" size={18} />Tìm</button>
      </form>
      {error && <Banner tone="error" title="Không tải được danh sách người dùng">{error}</Banner>}
      {!users && !error && <p className="text-stone-500">Đang tải…</p>}
      {users?.length === 0 && <EmptyState icon="search" title="Không tìm thấy tài khoản nào">Thử một phần khác của email.</EmptyState>}
      {!!users?.length && (
        <div className="card overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className={`grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border-b border-stone-100 px-6 py-4 last:border-0 ${u.is_blocked ? 'bg-red-50/40' : ''}`}>
              <span className={`grid size-12 place-items-center rounded-full text-xl font-bold ${u.is_blocked ? 'bg-stone-100 text-stone-500' : 'bg-teal-100 text-teal-800'}`}>{u.email[0].toUpperCase()}</span>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="truncate text-lg font-semibold">{u.email}</span>
                  {u.is_blocked && (
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 text-sm font-semibold text-red-700"><Icon name="lock" size={14} stroke={2.25} />Bị khoá</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
                  <span>{roleLabel[u.role]}</span>
                  <span>{u.phone ?? 'Chưa có số điện thoại'}</span>
                  <span>{u.email_verified ? 'Đã xác minh email' : 'Chưa xác minh email'}</span>
                  <span className="text-stone-500">Tạo {fmtStamp(u.created_at)}</span>
                </div>
              </div>
              <div>
                {u.role === 'admin' ? null : u.is_blocked ? (
                  <button type="button" className="btn btn-secondary px-4" disabled={busyId === u.id} onClick={() => setBlocked(u, false)}>
                    {busyId === u.id && <Spinner />}Mở khoá
                  </button>
                ) : (
                  <button type="button" className="btn btn-danger px-4" onClick={() => setBlocking(u)}>Khoá</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal open={!!blocking} title="Khoá tài khoản này?" keep="Không khoá" confirm="Khoá" busy={!!busyId}
        onConfirm={() => blocking && setBlocked(blocking, true)} onClose={() => setBlocking(null)}>
        {blocking?.email} sẽ bị đăng xuất ngay và không đăng nhập lại được.{blocking?.role === 'employer' && ' Các tin họ đang mở sẽ ẩn khỏi người tìm việc.'} Có thể mở khoá sau.
      </ConfirmModal>
    </main>
  )
}

// ---------- Báo cáo vi phạm (FR7) ----------

const REPORT_FILTERS: ['pending' | 'done' | 'all', string][] = [['pending', 'Chờ xử lý'], ['done', 'Đã xử lý'], ['all', 'Tất cả']]
const REPORT_OUTCOME: Record<AdminReport['status'], string> = { pending: '', resolved: 'Đã khoá tài khoản', dismissed: 'Đã bỏ qua' }

export function AdminReportsPage() {
  const toast = useToast()
  const { data: reports, error, reload } = useLoad(api.adminReports)
  const [filter, setFilter] = useState<'pending' | 'done' | 'all'>('pending')
  const [blocking, setBlocking] = useState<AdminReport | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const shown = reports?.filter((r) => filter === 'all' || (filter === 'pending') === (r.status === 'pending'))

  function decide(r: AdminReport, decision: 'block' | 'dismiss') {
    setBusyId(r.id)
    api.decideReport(r.id, decision)
      .then(() => { toast({ title: decision === 'block' ? 'Đã khoá tài khoản' : 'Đã bỏ qua báo cáo', body: r.reported.email }); reload() },
        (err: Error) => toast({ error: true, title: err.message }))
      .finally(() => { setBusyId(null); setBlocking(null) })
  }

  return (
    <main className="page gap-5">
      <AdminTitle title="Báo cáo" sub="Người dùng báo cáo nhau. Khoá tài khoản bị báo cáo nếu vi phạm, hoặc bỏ qua nếu chưa đủ căn cứ; người báo cáo được thông báo kết quả." />
      <Segmented label="Lọc báo cáo" options={REPORT_FILTERS} value={filter} onChange={setFilter} />
      {error && <Banner tone="error" title="Không tải được danh sách báo cáo">{error}</Banner>}
      {!reports && !error && <p className="text-stone-500">Đang tải…</p>}
      {shown?.length === 0 && <EmptyState icon="flag" title={filter === 'pending' ? 'Không có báo cáo nào chờ xử lý' : 'Không có báo cáo nào ở mục này'} />}
      <div className="flex flex-col gap-3.5">
        {shown?.map((r) => (
          <article key={r.id} className="card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 px-6 py-5">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="truncate text-xl leading-7 font-semibold">{r.reported.email}</h3>
                <span className="text-stone-600">{roleLabel[r.reported.role]}</span>
                {r.reported.is_blocked && (
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 text-sm font-semibold text-red-700"><Icon name="lock" size={14} stroke={2.25} />Bị khoá</span>
                )}
              </div>
              <p className="leading-6 whitespace-pre-line text-stone-800">“{r.reason}”</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-500">
                <span>Người báo cáo: <span className="text-stone-700">{r.reporter.email}</span></span>
                <span>Gửi {fmtStamp(r.created_at)}</span>
                {r.resolved_at && <span>{REPORT_OUTCOME[r.status]} {fmtStamp(r.resolved_at)}</span>}
              </div>
            </div>
            {r.status === 'pending' && (
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-secondary px-4" disabled={busyId === r.id} onClick={() => decide(r, 'dismiss')}>
                  {busyId === r.id && !blocking && <Spinner />}Bỏ qua
                </button>
                <button type="button" className="btn btn-danger px-4" disabled={busyId === r.id} onClick={() => setBlocking(r)}>Khoá tài khoản</button>
              </div>
            )}
          </article>
        ))}
      </div>

      <ConfirmModal open={!!blocking} title="Khoá tài khoản bị báo cáo?" keep="Không khoá" confirm="Khoá" busy={!!busyId}
        onConfirm={() => blocking && decide(blocking, 'block')} onClose={() => setBlocking(null)}>
        {blocking?.reported.email} sẽ bị đăng xuất ngay và không đăng nhập lại được.{blocking?.reported.role === 'employer' && ' Các tin họ đang mở sẽ ẩn khỏi người tìm việc.'} Các báo cáo khác đang chờ về người này cũng được đóng. Có thể mở khoá ở trang Người dùng.
      </ConfirmModal>
    </main>
  )
}
