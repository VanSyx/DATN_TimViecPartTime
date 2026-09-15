const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type Role = 'job_seeker' | 'employer' | 'admin'

export const roleHome: Record<Role, string> = {
  job_seeker: '/seeker',
  employer: '/employer',
  admin: '/admin',
}

export type User = {
  id: string
  email: string
  role: Role
  email_verified: boolean
  phone_verified: boolean
}

type Tokens = { access_token: string; refresh_token: string }

export const tokens = {
  get access() { return localStorage.getItem('access_token') },
  get refresh() { return localStorage.getItem('refresh_token') },
  set(t: Tokens) {
    localStorage.setItem('access_token', t.access_token)
    localStorage.setItem('refresh_token', t.refresh_token)
  },
  clear() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// FastAPI trả {detail: string} hoặc {detail: [{msg}]} (422); slowapi trả {error: string} (429)
function errorMessage(body: any, status: number): string {
  if (typeof body?.detail === 'string') return body.detail
  if (Array.isArray(body?.detail)) return body.detail.map((d: any) => d.msg).join('; ')
  if (typeof body?.error === 'string') return body.error
  return `Lỗi ${status}`
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (tokens.access) headers.set('Authorization', `Bearer ${tokens.access}`)

  const res = await fetch(API_URL + path, { ...init, headers })

  // Access token sống 15 phút: thử refresh 1 lần rồi gọi lại
  if (res.status === 401 && retry && tokens.refresh && path !== '/auth/refresh') {
    try {
      tokens.set(await post<Tokens>('/auth/refresh', { refresh_token: tokens.refresh }, false))
      return request<T>(path, init, false)
    } catch {
      tokens.clear()
    }
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, errorMessage(body, res.status))
  return body as T
}

function post<T>(path: string, data: unknown, retry = true) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(data) }, retry)
}

export const api = {
  register: (data: { email: string; password: string; role: Role; phone?: string }) =>
    post<User>('/auth/register', data),
  verify: (user_id: string, code: string) => post<User>('/auth/verify', { user_id, code }),
  login: (email: string, password: string) => post<Tokens>('/auth/login', { email, password }),
  me: () => request<User>('/auth/me'),
}
