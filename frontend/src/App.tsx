import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, NavLink, Outlet, RouterProvider } from 'react-router-dom'
import { roleHome, type Role } from './api'
import { AuthProvider, RequireRole, useAuth } from './auth'
import { LoginPage, RegisterPage, VerifyPage } from './pages/AuthPages'
import { AvailabilityPage, EmployerJobsPage, MyApplicationsPage, SearchJobsPage } from './pages/JobPages'

// Trang theo role — menu sinh từ chính danh sách này. Trang gợi ý AI thêm ở Tuần 5.
const pagesByRole: Record<Role, { path: string; label: string; element: ReactNode }[]> = {
  job_seeker: [
    { path: '/seeker', label: 'Tìm việc', element: <SearchJobsPage /> },
    { path: '/seeker/availability', label: 'Lịch rảnh', element: <AvailabilityPage /> },
    { path: '/seeker/applications', label: 'Đơn ứng tuyển', element: <MyApplicationsPage /> },
  ],
  employer: [{ path: '/employer', label: 'Tin đã đăng', element: <EmployerJobsPage /> }],
  admin: [{ path: '/admin', label: 'Quản trị', element: <h1>Trang quản trị</h1> }],
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
          {pagesByRole[user.role].map((item) => (
            <NavLink key={item.path} to={item.path} end>{item.label}</NavLink>
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
  ...(Object.entries(pagesByRole) as [Role, (typeof pagesByRole)[Role]][]).map(([role, pages]) => ({
    element: <RequireRole roles={[role]} />,
    children: [{ element: <AppLayout />, children: pages.map(({ path, element }) => ({ path, element })) }],
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
