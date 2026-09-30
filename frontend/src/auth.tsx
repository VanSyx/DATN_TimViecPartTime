import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { api, roleHome, tokens, type Role, type User } from './api'

type AuthState = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!tokens.access)

  useEffect(() => {
    if (!tokens.access) return
    api.me().then(setUser).catch(() => tokens.clear()).finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    tokens.set(await api.login(email, password))
    const me = await api.me()
    setUser(me)
    return me
  }

  // Tải lại trang chủ thay vì setUser(null): trang đang mở (RequireRole) sẽ kịp đẩy sang /login
  // trước khi điều hướng xong; tải lại cũng xoá sạch dữ liệu của phiên cũ trong bộ nhớ
  function logout() {
    tokens.clear()
    window.location.assign('/')
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider')
  return ctx
}

// Chỉ để điều hướng UI — quyền thật do backend enforce (require_role)
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="page text-stone-500">Đang tải…</p>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (!roles.includes(user.role)) return <Navigate to={roleHome[user.role]} replace />
  return <Outlet />
}
