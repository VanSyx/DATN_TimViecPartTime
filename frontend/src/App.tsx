import { createBrowserRouter, Link, Navigate, NavLink, Outlet, RouterProvider } from 'react-router-dom'
import { roleHome, type Role } from './api'
import { AuthProvider, RequireRole, useAuth } from './auth'
import { LoginPage, RegisterPage, VerifyPage } from './pages/AuthPages'
import { EmployerJobsPage, JobApplicantsPage, JobFormPage } from './pages/EmployerPages'
import { HomePage } from './pages/HomePage'
import { MyApplicationsPage, ProfilePage, RecommendPage, SearchPage } from './pages/SeekerPages'
import { Icon, Logo, ToastProvider } from './ui'

const NAV: Record<Role, [string, string][]> = {
  job_seeker: [['/seeker', 'Gợi ý cho tôi'], ['/tim-viec', 'Tìm việc'], ['/seeker/applications', 'Đơn ứng tuyển'], ['/seeker/profile', 'Hồ sơ & lịch rảnh']],
  employer: [['/employer', 'Tin đã đăng'], ['/employer/new', 'Đăng tin mới']],
  admin: [['/admin', 'Duyệt tin']],
}
const GUEST_NAV = [['/#cach-hoat-dong', 'Cách hoạt động'], ['/#goi-y-ai', 'Gợi ý AI'], ['/#cau-hoi', 'Câu hỏi']]

const roleLabel: Record<Role, string> = { job_seeker: 'Người tìm việc', employer: 'Người đăng tin', admin: 'Quản trị viên' }
const navItem = 'flex h-10 items-center rounded-[10px] px-3.5 whitespace-nowrap no-underline'
const navIdle = `${navItem} font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900`

function AccountMenu() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <details className="relative shrink-0">
      <summary className="flex h-10 cursor-pointer items-center gap-2.5 rounded-full border border-stone-200 pr-2.5 pl-1 hover:bg-stone-50">
        <span className="grid size-8 place-items-center rounded-full bg-teal-100 text-sm font-bold text-teal-800">{user.email[0].toUpperCase()}</span>
        <span className="text-sm text-stone-700">{user.email}</span>
        <Icon name="chevronDown" size={16} stroke={2} className="text-stone-500" />
      </summary>
      {/* Bấm một mục thì đóng menu (details không tự đóng khi chuyển trang) */}
      <div className="card absolute right-0 z-[1100] mt-2 flex w-60 flex-col p-1.5 shadow-md" onClick={(e) => { (e.currentTarget.parentElement as HTMLDetailsElement).open = false }}>
        <div className="px-3 py-2 text-sm text-stone-500">{roleLabel[user.role]}</div>
        {user.role === 'job_seeker' && <Link to="/seeker/profile" className="menu-item">Hồ sơ & lịch rảnh</Link>}
        <button type="button" className="menu-item text-red-700" onClick={logout}>Đăng xuất</button>
      </div>
    </details>
  )
}

function Shell() {
  const { user } = useAuth()
  return (
    <ToastProvider>
      <header className="h-16 border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-full w-[calc(100%-48px)] max-w-[1120px] items-center gap-10">
          <Link to="/" className="shrink-0 no-underline"><Logo /></Link>
          <nav className="flex min-w-0 flex-1 gap-1">
            {user
              ? NAV[user.role].map(([to, label]) => (
                <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? `${navItem} bg-teal-50 font-semibold text-teal-700` : navIdle)}>{label}</NavLink>
              ))
              : GUEST_NAV.map(([href, label]) => <a key={href} href={href} className={navIdle}>{label}</a>)}
          </nav>
          {user ? <AccountMenu /> : (
            <div className="flex shrink-0 items-center gap-2">
              <Link to="/login" className="btn btn-plain h-10 px-4">Đăng nhập</Link>
              <Link to="/register" className="btn btn-primary h-10">Đăng ký</Link>
            </div>
          )}
        </div>
      </header>
      <Outlet />
    </ToastProvider>
  )
}

function Home() {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to={roleHome[user.role]} replace /> : <HomePage />
}

// ponytail: S12 chỉ là khung, duyệt tin / khoá người dùng / báo cáo vi phạm làm cùng FR10 (wireframe W4)
function AdminPage() {
  return (
    <main className="page gap-5">
      <div className="flex items-center gap-3">
        <h1 className="h1">Duyệt tin</h1>
        <span className="flex h-7 items-center rounded-full bg-stone-900 px-3 text-[13px] font-semibold text-white">Quản trị viên</span>
      </div>
      <div className="card flex items-center gap-4 p-6 text-stone-600">
        <Icon name="info" className="text-sky-600" />
        Chức năng quản trị (duyệt tin, khoá tài khoản, xử lý báo cáo vi phạm) sẽ có ở các tuần sau.
      </div>
    </main>
  )
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify', element: <VerifyPage /> },
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/tim-viec', element: <SearchPage /> },
      {
        element: <RequireRole roles={['job_seeker']} />,
        children: [
          { path: '/seeker', element: <RecommendPage /> },
          { path: '/seeker/applications', element: <MyApplicationsPage /> },
          { path: '/seeker/profile', element: <ProfilePage /> },
        ],
      },
      {
        element: <RequireRole roles={['employer']} />,
        children: [
          { path: '/employer', element: <EmployerJobsPage /> },
          // key khác nhau: chuyển giữa "Đăng tin mới" và "Sửa tin" thì form khởi tạo lại
          { path: '/employer/new', element: <JobFormPage key="new" /> },
          { path: '/employer/jobs/:id/edit', element: <JobFormPage key="edit" /> },
          { path: '/employer/jobs/:id', element: <JobApplicantsPage /> },
        ],
      },
      { element: <RequireRole roles={['admin']} />, children: [{ path: '/admin', element: <AdminPage /> }] },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
