import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Job } from '../api'
import { ApplyButton, JobCard, JobDetailModal, PlaceSearch, type Detail, type Place } from '../job-ui'
import { AppStatusBadge, CardSkeleton, EmptyState, HeroArt, Icon, Logo, Segmented, type IconName } from '../ui'

const KINDS: [IconName, string, boolean][] = [
  ['home', 'Dọn dẹp nhà', false], ['baby', 'Trông trẻ', true], ['chef', 'Nấu ăn', false],
  ['coffee', 'Phụ quán / phụ bếp', true], ['heart', 'Chăm người già', false], ['shirt', 'Giặt ủi', true],
]

const STEPS = {
  seeker: [
    ['Khai giờ rảnh & mô tả bản thân', 'Chọn ngày và giờ bạn rảnh, giờ nào cũng được. Viết vài câu về việc bạn làm được.'],
    ['AI gợi ý việc hợp giờ, gần nhà', 'Mỗi gợi ý có điểm phù hợp và lý do rõ ràng bằng lời.'],
    ['Ứng tuyển và chờ nhận', 'Theo dõi đơn của bạn: Chờ duyệt, Đã nhận hoặc Bị từ chối.'],
  ],
  employer: [
    ['Đăng tin kèm giờ, địa chỉ, tiền công', 'Một tin là một buổi làm trong một ngày, tiền công tính cho cả buổi.'],
    ['Nhận đơn ứng tuyển', 'Xem email và số điện thoại của từng người ứng tuyển.'],
    ['Chọn người phù hợp', 'Bấm Nhận hoặc Từ chối — người ứng tuyển thấy trạng thái ngay.'],
  ],
}

const FAQ = [
  ['Có mất phí không?', 'Không. TimViecPartTime miễn phí cho cả người tìm việc và người đăng tin.'],
  ['Có cần CV không?', 'Không cần. Bạn chỉ cần viết vài câu mô tả bản thân: việc bạn làm được, kinh nghiệm, điều bạn mong muốn.'],
  ['Lịch rảnh khác ca làm cố định thế nào?', 'Bạn khai các khoảng rảnh theo từng ngày cụ thể, giờ nào cũng được (ví dụ 07:15–11:40), không bị gò vào ca Sáng/Chiều/Tối. Một việc chỉ được coi là hợp khi nằm trọn trong khoảng đó, đã tính thời gian đi lại.'],
  ['AI gợi ý dựa vào đâu?', 'Dựa trên 4 yếu tố: mức khớp mô tả (35%), giờ rảnh (35%), khoảng cách (20%) và độ tin cậy (10%). Gợi ý nào cũng kèm lý do.'],
  ['Chưa xác minh email có dùng được không?', 'Được. Bạn vẫn đăng nhập và dùng bình thường, có thể xác minh sau.'],
]

// Ví dụ minh hoạ cho khối "Gợi ý AI khác gì" — số liệu thật từ bản chạy thử (brief mục 8)
const SAMPLE_JOB: Job = {
  id: 'sample', employer_id: 'sample', status: 'open', created_at: '2026-09-24T00:00:00+07:00',
  title: 'Dọn dẹp nhà cửa sáng thứ 7', description: '', street: '06 Phan Huy Ôn', ward: 'Phường Hải Châu', city: 'Đà Nẵng',
  lat: 16.068, lng: 108.221, time_start: '2026-09-26T08:00:00+07:00', time_end: '2026-09-26T11:00:00+07:00', salary: 250000, distance_km: 0.51,
}
const SAMPLE_REC = { job: SAMPLE_JOB, final_score: 0.83, travel_minutes: 2, breakdown: { semantic: 0.55, time_feasibility: 1, geo: 0.9, trust: 1 } }
const SAMPLE_FREE = [{ id: 'sample', start_time: '2026-09-26T07:00:00+07:00', end_time: '2026-09-26T12:30:00+07:00' }]

const section = 'mx-auto w-[calc(100%-48px)] max-w-[1120px]'
const h2 = 'text-[30px] leading-[38px] font-semibold tracking-[-0.01em]'

export function HomePage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [tab, setTab] = useState<'seeker' | 'employer'>('seeker')
  const [detail, setDetail] = useState<Detail | null>(null)

  useEffect(() => {
    api.searchJobs({}).then(setJobs, () => setJobs([]))
  }, [])

  const goSearch = (p: Place) => navigate(`/tim-viec?${new URLSearchParams({ lat: String(p.lat), lng: String(p.lng), label: p.label })}`)

  return (
    <>
      <section className={`${section} grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-14 pt-16 pb-4`}>
        <div className="flex flex-col gap-6">
          <h1 className="text-5xl leading-[58px] font-bold tracking-[-0.025em] text-balance">
            Việc làm thêm vừa với <span className="text-teal-700">giờ rảnh</span> của bạn
          </h1>
          <p className="max-w-[520px] text-lg leading-7 text-pretty text-stone-600">
            Khai giờ rảnh và vài câu về bản thân — AI gợi ý việc gần nhà, nằm trong giờ bạn rảnh, và nói rõ vì sao.
          </p>
          <div className="card flex flex-col gap-3 p-5 shadow-sm">
            <span className="label">Bạn ở đâu?</span>
            <PlaceSearch onPick={goSearch} buttonLabel="Tìm việc quanh đây" hero />
          </div>
          <Link to="/register?role=employer" className="w-fit font-semibold no-underline">Bạn cần tuyển người? Đăng tin miễn phí →</Link>
        </div>
        <HeroArt className="h-[480px]" />
      </section>

      <section id="viec-moi" className={`${section} flex flex-col gap-6 pt-[72px]`}>
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3.5">
            <h2 className={h2}>Việc mới đăng</h2>
            {!!jobs?.length && (
              <span className="flex h-8 items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3.5 text-sm font-semibold text-teal-800">
                <span className="size-2 rounded-full bg-teal-600" />Đang có {jobs.length >= 100 ? '100+' : jobs.length} việc mở
              </span>
            )}
          </div>
          {!!jobs?.length && <Link to="/tim-viec" className="font-semibold no-underline">Xem tất cả việc →</Link>}
        </div>
        {!jobs && (
          <div className="grid grid-cols-3 gap-5" aria-busy="true">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        )}
        {jobs?.length === 0 && (
          <EmptyState icon="calendarPlus" title="Chưa có việc nào đang mở"
            actions={<><Link to="/register" className="btn btn-primary">Đăng ký tìm việc</Link><Link to="/register?role=employer" className="btn btn-secondary">Đăng tin đầu tiên</Link></>}>
            Bạn vẫn có thể đăng ký và khai giờ rảnh trước — khi có việc hợp, bạn sẽ thấy ngay trong mục Gợi ý cho tôi.
          </EmptyState>
        )}
        {!!jobs?.length && (
          <div className="grid grid-cols-3 gap-5">
            {jobs.slice(0, 6).map((job) => (
              <JobCard key={job.id} job={job} onDetail={() => setDetail({ job })} action={<ApplyButton job={job} className="h-10" />} />
            ))}
          </div>
        )}
      </section>

      <section className={`${section} flex flex-col gap-6 pt-[88px]`}>
        <div className="flex flex-col gap-1.5">
          <h2 className={h2}>Loại việc thường gặp</h2>
          <p className="text-stone-600">Một vài việc hay được đăng. Bạn tìm theo vị trí và giờ rảnh, không cần chọn ngành.</p>
        </div>
        <div className="grid grid-cols-6 gap-4">
          {KINDS.map(([icon, label, warm]) => (
            <div key={label} className="card flex flex-col items-start gap-3.5 px-4 py-5">
              <span className={`grid size-12 place-items-center rounded-full ${warm ? 'bg-orange-50 text-orange-700' : 'bg-teal-50 text-teal-700'}`}><Icon name={icon} size={24} stroke={1.5} /></span>
              <span className="font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="cach-hoat-dong" className={`${section} flex scroll-mt-6 flex-col gap-7 pt-[88px]`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className={h2}>Cách hoạt động</h2>
          <Segmented label="Vai trò" value={tab} onChange={setTab} options={[['seeker', 'Người tìm việc'], ['employer', 'Người đăng tin']]} />
        </div>
        <div className="grid grid-cols-3 gap-5">
          {STEPS[tab].map(([title, desc], i) => (
            <div key={title} className="card flex flex-col gap-3 p-6">
              <span className="grid size-11 place-items-center rounded-full border border-orange-200 bg-orange-50 text-xl font-bold text-orange-700">{i + 1}</span>
              <h3 className="text-lg leading-[26px] font-semibold text-pretty">{title}</h3>
              <p className="text-pretty text-stone-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="goi-y-ai" className="mt-[88px] scroll-mt-6 border-y border-stone-200 bg-white">
        <div className={`${section} grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-center gap-14 py-[72px]`}>
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-2.5">
              <span className="text-sm font-semibold tracking-[0.04em] text-teal-700 uppercase">Gợi ý AI khác gì</span>
              <h2 className={`${h2} text-balance`}>Không chỉ tìm theo từ khoá — AI xét giờ rảnh và quãng đường của bạn</h2>
            </div>
            {([
              ['file', 'Không lọc cứng theo ngành', 'AI đọc mô tả của bạn và của công việc để so khớp, bạn không cần chọn ngành nghề.'],
              ['clock', 'Xét giờ rảnh thật, tính cả thời gian đi lại', 'Việc phải nằm trọn trong khoảng bạn rảnh, sau khi cộng thời gian đi tới nơi.'],
              ['sparkles', 'Luôn nói rõ vì sao gợi ý', 'Mỗi việc kèm 3–4 lý do ngắn. Muốn xem kỹ, bấm “Xem cách tính điểm”.'],
            ] as [IconName, string, string][]).map(([icon, title, desc]) => (
              <div key={title} className="flex gap-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-teal-50 text-teal-700"><Icon name={icon} size={22} stroke={1.5} /></span>
                <div><div className="text-lg leading-[26px] font-semibold">{title}</div><div className="text-stone-600">{desc}</div></div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="flex h-7 w-fit items-center rounded-full bg-stone-100 px-3 text-sm font-semibold text-stone-600">Ví dụ minh hoạ</span>
            <JobCard job={SAMPLE_JOB} rec={SAMPLE_REC} intervals={SAMPLE_FREE} radius={5} />
          </div>
        </div>
      </section>

      <section className={`${section} flex flex-col gap-7 pt-[88px]`}>
        <h2 className={h2}>An tâm khi làm việc</h2>
        <div className="grid grid-cols-4 gap-5">
          {([
            ['clock', 'Tin ghi rõ giờ, địa chỉ, tiền công', 'Mỗi tin là một khung giờ trong một ngày, tiền công tính cho cả buổi.'],
            ['userCheck', 'Người đăng tin tự chọn người', 'Họ xem từng đơn ứng tuyển và quyết định nhận ai.'],
            ['list', 'Trạng thái đơn minh bạch', null],
            ['gift', 'Miễn phí cho cả hai bên', 'Không thu phí người tìm việc lẫn người đăng tin.'],
          ] as [IconName, string, string | null][]).map(([icon, title, desc]) => (
            <div key={title} className="flex flex-col gap-3">
              <Icon name={icon} size={28} stroke={1.5} className="text-teal-700" />
              <div className="text-lg leading-[26px] font-semibold">{title}</div>
              {desc ? <div className="text-stone-600">{desc}</div> : (
                <div className="flex flex-wrap gap-1.5"><AppStatusBadge status="pending" /><AppStatusBadge status="accepted" /><AppStatusBadge status="rejected" /></div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={`${section} pt-[88px]`}>
        <div className="flex flex-wrap items-center gap-8 rounded-2xl bg-teal-700 px-12 py-11">
          <div className="flex min-w-[280px] flex-1 flex-col gap-2">
            <h2 className={`${h2} text-white`}>Cần người giúp việc theo giờ?</h2>
            <p className="text-lg text-teal-50">Đăng tin miễn phí, chọn người ở gần.</p>
          </div>
          <Link to="/register?role=employer" className="btn btn-primary h-[52px] px-7 text-lg">Đăng tin ngay</Link>
        </div>
      </section>

      <section id="cau-hoi" className="mx-auto flex w-[calc(100%-48px)] max-w-[800px] scroll-mt-6 flex-col gap-6 pt-[88px] pb-24">
        <h2 className={`${h2} text-center`}>Câu hỏi thường gặp</h2>
        <div className="card overflow-hidden">
          {FAQ.map(([q, a], i) => (
            <details key={q} open={i === 0} className="group border-b border-stone-100 last:border-0">
              <summary className="flex min-h-[60px] cursor-pointer items-center gap-4 pr-5 pl-6 text-lg font-semibold hover:bg-stone-50">
                <span className="flex-1">{q}</span>
                <Icon name="chevronDown" stroke={2} className="text-stone-600 group-open:rotate-180" />
              </summary>
              <p className="pr-14 pb-5 pl-6 leading-[26px] text-pretty text-stone-700">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="bg-stone-900 text-stone-200">
        <div className={`${section} flex flex-col gap-10 pt-14 pb-7`}>
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-10">
            <div className="flex flex-col gap-3.5">
              <Logo dark />
              <p className="max-w-[380px] text-stone-300">Kết nối người làm thêm theo giờ với hộ gia đình và cơ sở nhỏ quanh bạn.</p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="font-semibold text-white">Người tìm việc</div>
              <Link to="/tim-viec" className="text-stone-300 no-underline hover:text-white">Tìm việc</Link>
              <Link to="/seeker" className="text-stone-300 no-underline hover:text-white">Gợi ý cho tôi</Link>
              <Link to="/register" className="text-stone-300 no-underline hover:text-white">Đăng ký</Link>
            </div>
            <div className="flex flex-col gap-3">
              <div className="font-semibold text-white">Người đăng tin</div>
              <Link to="/register?role=employer" className="text-stone-300 no-underline hover:text-white">Đăng tin</Link>
            </div>
          </div>
          <div className="border-t border-stone-700 pt-5 text-sm text-stone-400">Đồ án tốt nghiệp · 2026</div>
        </div>
      </footer>

      <JobDetailModal item={detail} onClose={() => setDetail(null)} />
    </>
  )
}
