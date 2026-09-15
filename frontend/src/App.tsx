import { createBrowserRouter, Navigate, NavLink, Outlet, RouterProvider } from 'react-router-dom'
import { roleHome, type Role } from './api'
import { AuthProvider, RequireRole, useAuth } from './auth'
import { LoginPage, RegisterPage, VerifyPage } from './pages/AuthPages'

// Menu theo role; các trang đích (job, lịch rảnh, duyệt tin...) làm từ Tuần 3
const navByRole: Record<Role, { to: string; label: string }[]> = {
  job_seeker: [{ to: '/seeker', label: 'Việc gợi ý' }],
  employer: [{ to: '/employer', label: 'Tin đã đăng' }],
  admin: [{ to: '/admin', label: 'Quản trị' }],
}

const roleLabel: Record<Role, string> = {
  job_seeker: 'Người tìm việc',
  employer: 'Nhà tuyển dụng',
  admin: 'Quản trị viên',
}

function AppLayout() {
  const { user, logout } = useAuth()
  if (!user) return null // RequireRole bọc ngoài đã redirect
  return (
    <>
      <header className="app-header">
        <strong>TimViecPartTime</strong>
        <nav>
          {navByRole[user.role].map((item) => (
            <NavLink key={item.to} to={item.to}>{item.label}</NavLink>
          ))}
        </nav>
        <span>{user.email} · {roleLabel[user.role]}</span>
        <button onClick={logout}>Đăng xuất</button>
      </header>
      {!user.email_verified && <p className="banner">Email chưa được xác minh.</p>}
      <main>
        <Outlet />
      </main>
    </>
  )
}

function Placeholder({ title }: { title: string }) {
  return <h1>{title}</h1>
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <p>Đang tải...</p>
  return <Navigate to={user ? roleHome[user.role] : '/login'} replace />
}

const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify', element: <VerifyPage /> },
  ...([
    ['job_seeker', '/seeker', 'Việc gợi ý cho bạn'],
    ['employer', '/employer', 'Tin tuyển dụng của bạn'],
    ['admin', '/admin', 'Trang quản trị'],
  ] as const).map(([role, path, title]) => ({
    element: <RequireRole roles={[role]} />,
    children: [{ element: <AppLayout />, children: [{ path, element: <Placeholder title={title} /> }] }],
  })),
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
