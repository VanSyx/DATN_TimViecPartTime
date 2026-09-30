import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError, roleHome, type Role, type User } from '../api'
import { useAuth } from '../auth'
import { Banner, FieldError, HeroArt, Icon, Logo, Spinner } from '../ui'

// Chỉ nhận đường dẫn nội bộ: "//evil.com" và "/\evil.com" (trình duyệt đổi \ thành /) đều là URL ngoài
const safeNext = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : null)
const asApiError = (err: unknown) => (err instanceof ApiError ? err : new ApiError(0, 'Không kết nối được máy chủ, vui lòng thử lại sau.'))

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-2 bg-white">
      <div className="flex flex-col px-12 py-6">
        <div className="flex h-12 items-center justify-between">
          <Link to="/" className="no-underline"><Logo /></Link>
          <Link to="/" className="font-semibold no-underline">← Về trang chủ</Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="flex w-full max-w-[440px] flex-col gap-5">{children}</div>
        </div>
      </div>
      <div className="flex flex-col gap-6 border-l border-teal-100 bg-teal-50 p-10">
        <HeroArt className="flex-1" />
        <div className="flex flex-col gap-1.5 px-2 pb-2">
          <div className="text-2xl leading-8 font-semibold text-teal-900">Việc làm thêm vừa với giờ rảnh của bạn</div>
          <div className="text-teal-800">Mỗi gợi ý đều nói rõ vì sao: hợp giờ, gần nhà, khớp mô tả.</div>
        </div>
      </div>
    </div>
  )
}

function PasswordInput({ invalid, ...props }: { invalid?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <div className={`input flex items-center gap-2 pr-2 ${invalid ? 'border-2 border-red-600' : ''}`}>
      <input {...props} type={show ? 'text' : 'password'} className="h-full min-w-0 flex-1 bg-transparent outline-none" />
      <button type="button" title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShow(!show)}
        className="grid size-9 cursor-pointer place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
        <Icon name={show ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const locked = error?.status === 429 // slowapi: 5 lần/phút

  useEffect(() => {
    if (!locked) return
    const t = setTimeout(() => setError(null), 60_000)
    return () => clearTimeout(t)
  }, [locked])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setError(null)
    setBusy(true)
    try {
      const user = await login(String(f.get('email')), String(f.get('password')))
      navigate(safeNext(params.get('next')) ?? roleHome[user.role], { replace: true })
    } catch (err) {
      setError(asApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <h1 className="h1">Đăng nhập</h1>
          <p className="text-stone-600">Chào bạn quay lại TimViecPartTime.</p>
        </div>
        {locked && (
          <Banner tone="warn" icon="lock" title="Bạn đã thử quá nhiều lần">
            Đăng nhập tạm bị chặn để bảo vệ tài khoản. Vui lòng thử lại sau ít phút.
          </Banner>
        )}
        <label className="field">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" required autoComplete="email" placeholder="ban@email.com" defaultValue={params.get('email') ?? ''} />
        </label>
        <div className="field">
          <label htmlFor="password" className="label">Mật khẩu</label>
          <PasswordInput id="password" name="password" required maxLength={72} autoComplete="current-password" invalid={!!error && !locked} />
          {error && !locked && <FieldError>{error.message}</FieldError>}
        </div>
        <button className="btn btn-primary h-12" disabled={busy || locked}>{busy ? <><Spinner />Đang đăng nhập…</> : 'Đăng nhập'}</button>
        <p className="text-center text-stone-600">Chưa có tài khoản? <Link to="/register" className="font-semibold no-underline">Đăng ký</Link></p>
      </form>
    </AuthLayout>
  )
}

const ROLES: [Role, string, string][] = [
  ['job_seeker', 'Tìm việc', 'Làm thêm theo giờ rảnh, gần nhà'],
  ['employer', 'Tuyển người', 'Đăng tin tìm người giúp việc theo giờ'],
]

export function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [role, setRole] = useState<Role>(params.get('role') === 'employer' ? 'employer' : 'job_seeker')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [triedEmail, setTriedEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const exists = error?.status === 409

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const email = String(f.get('email'))
    setError(null)
    setBusy(true)
    try {
      const user = await api.register({ email, password, role, phone: String(f.get('phone')).trim() || undefined })
      navigate(`/verify?user_id=${user.id}&email=${encodeURIComponent(user.email)}`)
    } catch (err) {
      setError(asApiError(err))
      setTriedEmail(email)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <h1 className="h1">Tạo tài khoản</h1>
          <p className="text-stone-600">Miễn phí, không cần CV.</p>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Bạn muốn</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(([k, title, desc]) => (
              <label key={k} className={`relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600 ${role === k ? 'border-teal-600 bg-teal-50 text-teal-800 ring-1 ring-teal-600' : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50'}`}>
                <input type="radio" name="role" value={k} checked={role === k} onChange={() => setRole(k)} className="sr-only" />
                {role === k && <Icon name="checkCircle" className="absolute top-3 right-3 text-teal-600" />}
                <span className="text-lg font-semibold">{title}</span>
                <span className={`text-sm leading-5 ${role === k ? 'text-teal-800' : 'text-stone-600'}`}>{desc}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="email" className="label">Email</label>
          <input id="email" className="input" name="email" type="email" required autoComplete="email" placeholder="ban@email.com" aria-invalid={exists} />
          {exists && (
            <FieldError>Email này đã được đăng ký. <Link to={`/login?email=${encodeURIComponent(triedEmail)}`} className="font-semibold">Đăng nhập bằng email này</Link></FieldError>
          )}
        </div>
        <div className="field">
          <label htmlFor="password" className="label">Mật khẩu</label>
          <PasswordInput id="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className={`flex items-center gap-1.5 text-sm ${password.length >= 8 ? 'text-green-700' : 'text-stone-500'}`}>
            <Icon name="checkCircle" size={16} stroke={2} />Ít nhất 8 ký tự
          </div>
        </div>
        <div className="field">
          <label htmlFor="phone" className="label">Số điện thoại <span className="font-normal text-stone-500">(tuỳ chọn)</span></label>
          <input id="phone" className="input" name="phone" type="tel" maxLength={20} autoComplete="tel" placeholder="VD: 0905 123 456" />
          <span className="text-sm text-stone-500">
            {role === 'employer' ? 'Giúp người ứng tuyển liên lạc với bạn khi cần.' : 'Người đăng tin dùng số này để gọi cho bạn.'}
          </span>
        </div>
        {error && !exists && <FieldError>{error.message}</FieldError>}
        <button className="btn btn-primary h-12" disabled={busy}>{busy ? <><Spinner />Đang tạo…</> : 'Tạo tài khoản'}</button>
        <p className="text-center text-stone-600">Đã có tài khoản? <Link to="/login" className="font-semibold no-underline">Đăng nhập</Link></p>
      </form>
    </AuthLayout>
  )
}

/** 6 ô hiển thị + 1 input trong suốt phủ lên trên: dán mã, tự điền từ SMS/email vẫn chạy như input thường. */
function OtpInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid: boolean }) {
  const [focus, setFocus] = useState(false)
  return (
    <div className="relative grid grid-cols-6 gap-2.5">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={`flex h-16 items-center justify-center rounded-[10px] border text-[28px] font-semibold ${invalid ? 'border-2 border-red-600 bg-red-50' : focus && i === Math.min(value.length, 5) ? 'border-2 border-teal-600 ring-4 ring-teal-100' : 'border-stone-300'}`}>
          {value[i]}
        </div>
      ))}
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        inputMode="numeric" autoComplete="one-time-code" autoFocus aria-label="Mã xác minh 6 số" className="absolute inset-0 cursor-text opacity-0" />
    </div>
  )
}

export function VerifyPage() {
  const [params] = useSearchParams()
  const userId = params.get('user_id') ?? ''
  const email = params.get('email') ?? ''
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<User | null>(null)
  const loginLink = `/login${email ? `?email=${encodeURIComponent(email)}` : ''}`

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      setDone(await api.verify(userId, code))
    } catch (err) {
      setError(asApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const seeker = done.role === 'job_seeker'
    return (
      <AuthLayout>
        <span className="grid size-16 place-items-center rounded-full bg-green-50 text-green-600"><Icon name="checkCircle" size={34} /></span>
        <div className="flex flex-col gap-1.5">
          <h1 className="h1">Email đã được xác minh</h1>
          <p className="text-stone-600">
            {seeker ? 'Bước tiếp theo: khai giờ rảnh và vài câu mô tả để AI bắt đầu gợi ý việc cho bạn.' : 'Bước tiếp theo: đăng tin đầu tiên để người ở gần, hợp giờ thấy việc của bạn.'}
          </p>
        </div>
        <Link to={`/login?next=${seeker ? '/seeker/profile' : '/employer/new'}&email=${encodeURIComponent(done.email)}`} className="btn btn-primary h-12">
          {seeker ? 'Khai hồ sơ ngay' : 'Đăng tin ngay'}
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        <span className="grid size-14 place-items-center rounded-full bg-teal-50 text-teal-700"><Icon name="mail" size={28} stroke={1.5} /></span>
        <div className="flex flex-col gap-1.5">
          <h1 className="h1">Xác minh email</h1>
          <p className="text-stone-600">Nhập mã 6 số đã gửi tới {email ? <b className="font-semibold text-stone-900">{email}</b> : 'email của bạn'}</p>
        </div>
        <OtpInput value={code} onChange={(v) => { setCode(v); setError('') }} invalid={!!error} />
        {error && <FieldError>{error}</FieldError>}
        <button className="btn btn-primary h-12" disabled={busy || code.length !== 6 || !userId}>{busy ? <><Spinner />Đang xác minh…</> : 'Xác minh'}</button>
        <div className="flex flex-col gap-1 border-t border-stone-100 pt-4">
          <Link to={loginLink} className="font-semibold no-underline">Để sau, đăng nhập luôn →</Link>
          <span className="text-sm text-stone-500">Chưa xác minh bạn vẫn dùng được đầy đủ.</span>
        </div>
      </form>
    </AuthLayout>
  )
}
