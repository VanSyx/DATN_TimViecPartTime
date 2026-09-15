import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, roleHome, type Role } from '../api'
import { useAuth } from '../auth'

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

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { error, busy, wrap } = useSubmit()

  const onSubmit = wrap(async (f) => {
    const user = await login(String(f.get('email')), String(f.get('password')))
    navigate(roleHome[user.role], { replace: true })
  })

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h1>Đăng nhập</h1>
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Mật khẩu<input name="password" type="password" required maxLength={72} autoComplete="current-password" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? 'Đang xử lý...' : 'Đăng nhập'}</button>
      <p>Chưa có tài khoản? <Link to="/register">Đăng ký</Link></p>
    </form>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { error, busy, wrap } = useSubmit()

  const onSubmit = wrap(async (f) => {
    const user = await api.register({
      email: String(f.get('email')),
      password: String(f.get('password')),
      role: f.get('role') as Role,
      phone: String(f.get('phone')) || undefined,
    })
    navigate(`/verify?user_id=${user.id}`)
  })

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h1>Đăng ký</h1>
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Mật khẩu<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
      <label>Số điện thoại (tuỳ chọn)<input name="phone" type="tel" maxLength={20} /></label>
      <label>
        Vai trò
        <select name="role" defaultValue="job_seeker">
          <option value="job_seeker">Người tìm việc</option>
          <option value="employer">Nhà tuyển dụng</option>
        </select>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? 'Đang xử lý...' : 'Đăng ký'}</button>
      <p>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
    </form>
  )
}

export function VerifyPage() {
  const [params] = useSearchParams()
  const userId = params.get('user_id') ?? ''
  const [done, setDone] = useState(false)
  const { error, busy, wrap } = useSubmit()

  const onSubmit = wrap(async (f) => {
    await api.verify(userId, String(f.get('code')))
    setDone(true)
  })

  if (done) {
    return (
      <div className="auth-form">
        <h1>Xác minh thành công</h1>
        <Link to="/login">Đăng nhập ngay</Link>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h1>Xác minh email</h1>
      <p>Nhập mã 6 số đã gửi tới email của bạn.</p>
      <label>Mã xác minh<input name="code" inputMode="numeric" pattern="\d{6}" required autoComplete="one-time-code" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy || !userId}>{busy ? 'Đang xử lý...' : 'Xác minh'}</button>
      <p><Link to="/login">Để sau, đăng nhập luôn</Link></p>
    </form>
  )
}
