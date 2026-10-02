import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { ApplicationStatus, Job } from './api'

// ---------- Định dạng (brief mục 8: "T7, 26/09 · 08:00–11:00", "250.000 đ", "0,5 km") ----------

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const pad = (n: number) => String(n).padStart(2, '0')

export const fmtDay = (t: string | Date) => {
  const d = new Date(t)
  return `${WEEKDAY[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}
export const fmtHM = (t: string | Date) => {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fmtSlot = (start: string, end: string) =>
  isNaN(+new Date(start)) ? 'Chưa chọn ngày giờ' : `${fmtDay(start)} · ${fmtHM(start)}–${fmtHM(end)}`
export const fmtStamp = (t: string) => `${fmtDay(t).slice(-5)}, ${fmtHM(t)}`
export const fmtMoney = (n: number) => `${n.toLocaleString('vi-VN')} đ`
export const fmtNum = (n: number, digits = 2) => n.toLocaleString('vi-VN', { maximumFractionDigits: digits })
export const fmtPct = (v: number) => `${Math.round(v * 100)}%`
export const fmtRating = (avg?: number | null, n = 0) => (n ? `${fmtNum(avg ?? 0, 1)} ★ · ${n} đánh giá` : 'Chưa có đánh giá')
export const fmtHours = (start: string, end: string) => `${fmtNum((+new Date(end) - +new Date(start)) / 3_600_000, 1)} giờ`

/** Giá trị cho <input type="date"> theo giờ địa phương. */
export const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** Ngày + giờ địa phương (từ <input type="date|time">) → ISO có múi giờ cho API. */
export const toIso = (date: string, time: string) => new Date(`${date}T${time}`).toISOString()
/** "07:15" → 7.25 */
export const hm = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60
export const fullAddress = (job: Job) => [job.street, job.ward, job.city].filter(Boolean).join(', ')
export const jobEnded = (job: Job) => job.status !== 'open' || new Date(job.time_end) <= new Date()

// ---------- Icon (nét Lucide, vẽ inline để khỏi thêm thư viện) ----------

const ICONS = {
  pin: <><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  calendar: <><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  calendarPlus: <><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" /></>,
  checkCircle: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  xCircle: <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>,
  alert: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>,
  warning: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" /></>,
  cloudOff: <><path d="m2 2 20 20" /><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193" /><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  locate: <><path d="M2 12h3M19 12h3M12 2v3M12 19v3" /><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" /></>,
  map: <><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" /><path d="M15 5.764v15M9 3.236v15" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M20 6 9 17l-5-5" />,
  pencil: <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />,
  phone: <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />,
  lock: <><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  eye: <><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" /></>,
  home: <><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  baby: <><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" /></>,
  chef: <><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" /><path d="M6 17h12" /></>,
  coffee: <><path d="M10 2v2M14 2v2M6 2v2" /><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /></>,
  heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  shirt: <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />,
  file: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8" /></>,
  sparkles: <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />,
  userCheck: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></>,
  list: <path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13" />,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></>,
  hourglass: <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />,
  ban: <><circle cx="12" cy="12" r="10" /><path d="M4.9 4.9l14.2 14.2" /></>,
  star: <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />,
}
export type IconName = keyof typeof ICONS

export function Icon({ name, size = 20, className = '', stroke = 1.75 }: { name: IconName; size?: number; className?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

export const Spinner = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" className="shrink-0 animate-spin" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-[10px] bg-teal-600">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" stroke="#fff" strokeWidth="2" />
          <path d="M12 7.5V12l3 2" stroke="#FDBA74" strokeWidth="2.25" />
        </svg>
      </span>
      <span className={`text-xl font-bold tracking-[-0.02em] ${dark ? 'text-white' : 'text-stone-900'}`}>
        TimViec<span className={dark ? 'text-teal-300' : 'text-teal-700'}>PartTime</span>
      </span>
    </span>
  )
}

export function IconLine({ icon, children, className = '' }: { icon: IconName; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Icon name={icon} size={18} className="text-stone-500" />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

// ---------- Badge trạng thái (luôn có chữ + icon/chấm, không chỉ màu) ----------

const APP_STATUS: Record<ApplicationStatus, [string, string, IconName]> = {
  pending: ['Chờ duyệt', 'border-amber-200 bg-amber-50 text-amber-800', 'clock'],
  accepted: ['Đã nhận', 'border-green-200 bg-green-50 text-green-700', 'checkCircle'],
  rejected: ['Bị từ chối', 'border-red-200 bg-red-50 text-red-700', 'xCircle'],
  cancelled: ['Đã hủy', 'border-stone-200 bg-stone-100 text-stone-700', 'ban'],
}

export function AppStatusBadge({ status }: { status: ApplicationStatus }) {
  const [label, cls, icon] = APP_STATUS[status]
  return (
    <span className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${cls}`}>
      <Icon name={icon} size={16} stroke={2} />{label}
    </span>
  )
}

const JOB_STATUS: Record<Job['status'], [string, string, string]> = {
  open: ['Đang mở', 'border-green-200 bg-green-50 text-green-700', 'bg-green-600'],
  closed: ['Đã đóng', 'border-stone-200 bg-stone-100 text-stone-700', 'bg-stone-400'],
  pending_approval: ['Chờ duyệt', 'border-amber-200 bg-amber-50 text-amber-800', 'bg-amber-500'],
  rejected: ['Bị từ chối', 'border-red-200 bg-red-50 text-red-700', 'bg-red-600'],
}

export function JobStatusBadge({ status }: { status: Job['status'] }) {
  const [label, cls, dot] = JOB_STATUS[status]
  return (
    <span className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold ${cls}`}>
      <span className={`size-2 rounded-full ${dot}`} />{label}
    </span>
  )
}

// ---------- Khối thông báo ----------

const TONES = {
  info: ['border-sky-200 bg-sky-50', 'text-sky-600', 'text-stone-900', 'info'],
  warn: ['border-amber-200 bg-amber-50', 'text-amber-700', 'text-amber-900', 'warning'],
  error: ['border-red-200 bg-red-50', 'text-red-600', 'text-red-900', 'alert'],
} as const

export function Banner({ tone = 'info', icon, title, children, action }: {
  tone?: keyof typeof TONES; icon?: IconName; title: ReactNode; children?: ReactNode; action?: ReactNode
}) {
  const [box, iconCls, text, defIcon] = TONES[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-center gap-4 rounded-xl border py-4 pr-4 pl-5 ${box}`}>
      <Icon name={icon ?? defIcon} size={24} className={iconCls} />
      <div className={`flex flex-1 flex-col gap-0.5 ${text}`}>
        <div className="font-semibold">{title}</div>
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-center gap-1.5 text-sm text-red-700">
      <Icon name="alert" size={16} stroke={2} className="text-red-600" /><span>{children}</span>
    </div>
  )
}

export function EmptyState({ icon, title, children, actions }: { icon: IconName; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3.5 px-8 py-12 text-center">
      <span className="grid size-24 place-items-center rounded-full bg-teal-50 text-teal-700"><Icon name={icon} size={40} stroke={1.5} /></span>
      <h2 className="mt-2 text-xl font-semibold">{title}</h2>
      {children && <p className="max-w-[460px] text-pretty text-stone-600">{children}</p>}
      {actions && <div className="mt-1.5 flex gap-3">{actions}</div>}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="card flex h-60 flex-col gap-3 p-5">
      <div className="h-5 w-4/5 rounded-md bg-stone-200" /><div className="h-5 w-1/2 rounded-md bg-stone-200" />
      <div className="mt-1.5 h-4 w-2/3 rounded-md bg-stone-100" /><div className="h-4 w-1/2 rounded-md bg-stone-100" />
    </div>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: {
  options: [T, string][]; value: T; onChange: (v: T) => void; label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-fit gap-1 rounded-xl bg-stone-100 p-1">
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} onClick={() => onChange(v)}
          className={`h-10 cursor-pointer rounded-[9px] px-4 text-base whitespace-nowrap ${v === value ? 'bg-white font-semibold text-teal-800 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}>
          {text}
        </button>
      ))}
    </div>
  )
}

export function ScoreRing({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const [ring, text, word] = pct >= 70 ? ['stroke-teal-600', 'text-teal-700', 'Rất phù hợp']
    : pct >= 50 ? ['stroke-teal-400', 'text-teal-700', 'Khá phù hợp']
      : ['stroke-stone-400', 'text-stone-600', 'Ít phù hợp']
  const C = 2 * Math.PI * 30
  return (
    <div className="flex w-[84px] shrink-0 flex-col items-center gap-1.5">
      <div className="relative size-[72px]">
        <svg viewBox="0 0 72 72" className="size-full -rotate-90" fill="none" aria-hidden="true">
          <circle cx="36" cy="36" r="30" strokeWidth="7" className="stroke-stone-100" />
          <circle cx="36" cy="36" r="30" strokeWidth="7" strokeLinecap="round" className={ring} strokeDasharray={`${C * value} ${C}`} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-bold tracking-[-0.02em]">{pct}%</span>
      </div>
      <span className={`text-center text-sm leading-[18px] font-semibold ${text}`}>{word}</span>
    </div>
  )
}

/** Minh hoạ tạm cho hero/trang tài khoản (chưa có ảnh minh hoạ): tuần rảnh + 1 việc nằm trọn trong giờ rảnh. */
export function HeroArt({ className = '' }: { className?: string }) {
  const days: [string, [number, number][]][] = [['T6', [[13, 18]]], ['T7', [[7, 12.5]]], ['CN', [[8, 17]]], ['T2', [[13.5, 17.5]]], ['T3', [[14, 18]]]]
  const x = (h: number) => `${((h - 6) / 16) * 100}%`
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-teal-100 via-teal-50 to-orange-50 p-10 ${className}`}>
      <div className="card flex w-full max-w-[400px] flex-col gap-3 p-5 shadow-md">
        <div className="flex items-center gap-2 font-semibold"><Icon name="calendar" className="text-teal-700" />Giờ rảnh tuần này</div>
        {days.map(([d, blocks]) => (
          <div key={d} className="grid grid-cols-[32px_1fr] items-center gap-3">
            <span className="text-sm font-semibold">{d}</span>
            <div className="relative h-5 rounded-md bg-stone-100">
              {blocks.map(([a, b]) => <div key={a} className="absolute inset-y-0 rounded-md bg-teal-300" style={{ left: x(a), width: `calc(${x(b)} - ${x(a)})` }} />)}
              {d === 'T7' && <div className="absolute inset-y-1 rounded bg-stone-800" style={{ left: x(8), width: `calc(${x(11)} - ${x(8)})` }} />}
            </div>
          </div>
        ))}
        <div className="flex justify-between pl-11 text-xs text-stone-500"><span>6h</span><span>14h</span><span>22h</span></div>
      </div>
      <div className="card absolute bottom-9 left-6 flex flex-col gap-1 px-[18px] py-3.5 shadow-[0_10px_30px_rgba(28,25,23,0.12)]">
        <div className="flex items-center gap-2 font-semibold"><Icon name="checkCircle" className="text-green-600" />Nằm trọn trong giờ rảnh của bạn</div>
        <div className="pl-7 text-sm text-stone-600">T7, 26/09 · 08:00–11:00 · cách 0,51 km</div>
      </div>
    </div>
  )
}

// ---------- Modal (thẻ <dialog> gốc: có sẵn nền phủ, Esc để đóng, giữ focus) ----------

export function Modal({ open, onClose, className = '', children }: { open: boolean; onClose: () => void; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  // Chỉ render nội dung sau khi dialog đã hiện: bản đồ Leaflet bên trong cần kích thước thật lúc khởi tạo
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const d = ref.current!
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
    setShown(open)
  }, [open])
  return (
    // React cho sự kiện close của dialog con nổi bọt lên dialog cha: chỉ nhận close của chính nó
    <dialog ref={ref} onClose={(e) => e.target === e.currentTarget && onClose()} onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`m-auto max-h-[calc(100vh-48px)] max-w-[calc(100vw-48px)] overflow-hidden rounded-2xl bg-white p-0 text-stone-900 shadow-[0_24px_60px_rgba(28,25,23,0.28)] backdrop:bg-stone-900/50 ${className}`}>
      {shown && children}
    </dialog>
  )
}

export function ModalHeader({ title, onClose }: { title: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 pt-6 pr-6 pl-7">
      <h2 className="text-2xl leading-8 font-semibold">{title}</h2>
      <button type="button" title="Đóng" onClick={onClose} className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-[10px] text-stone-700 hover:bg-stone-100">
        <Icon name="x" size={22} stroke={2} />
      </button>
    </div>
  )
}

export function ConfirmModal({ open, title, keep, confirm, busy, onConfirm, onClose, children }: {
  open: boolean; title: string; keep: string; confirm: string; busy: boolean; onConfirm: () => void; onClose: () => void; children: ReactNode
}) {
  return (
    <Modal open={open} onClose={onClose} className="w-[440px]">
      <div className="flex flex-col gap-3.5 p-6">
        <h2 className="text-2xl leading-8 font-semibold">{title}</h2>
        <p className="text-stone-700">{children}</p>
        <div className="mt-1.5 flex justify-end gap-2.5">
          <button type="button" className="btn btn-plain" onClick={onClose}>{keep}</button>
          <button type="button" className="btn bg-red-600 text-white hover:not-disabled:bg-red-700" disabled={busy} onClick={onConfirm}>{busy && <Spinner />}{confirm}</button>
        </div>
      </div>
    </Modal>
  )
}

// ---------- Toast ----------

type ToastMsg = { title: string; body?: ReactNode; error?: boolean }
const ToastContext = createContext<(t: ToastMsg) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 5000)
    return () => clearTimeout(t)
  }, [msg])
  return (
    <ToastContext.Provider value={setMsg}>
      {children}
      {msg && (
        <div role="status" className={`fixed top-[84px] right-6 z-[2000] flex w-[380px] items-start gap-3 rounded-xl border bg-white p-4 shadow-[0_10px_30px_rgba(28,25,23,0.14)] ${msg.error ? 'border-red-200' : 'border-green-200'}`}>
          <Icon name={msg.error ? 'xCircle' : 'checkCircle'} size={22} className={msg.error ? 'text-red-600' : 'text-green-600'} />
          <div className="flex flex-1 flex-col gap-0.5">
            <div className={`font-semibold ${msg.error ? 'text-red-700' : 'text-green-700'}`}>{msg.title}</div>
            {msg.body && <div className="text-sm leading-5 text-stone-600">{msg.body}</div>}
          </div>
          <button type="button" title="Đóng" onClick={() => setMsg(null)} className="cursor-pointer text-stone-500 hover:text-stone-900"><Icon name="x" size={18} stroke={2} /></button>
        </div>
      )}
    </ToastContext.Provider>
  )
}

// ---------- Hook tải dữ liệu / gửi form ----------

/** Tải dữ liệu 1 lần + hàm reload sau khi thay đổi. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const reload = useCallback(() => {
    load().then((d) => { setData(d); setError('') }, (err: Error) => setError(err.message))
  }, [load])
  useEffect(reload, [reload])
  return { data, error, reload }
}

export function useSubmit() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  function wrap(fn: (form: FormData) => Promise<void>) {
    return async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setError('')
      setBusy(true)
      try {
        await fn(new FormData(e.currentTarget))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
      } finally {
        setBusy(false)
      }
    }
  }
  return { error, busy, wrap }
}
