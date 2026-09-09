import { Suspense } from 'react'
import { LogOut, Utensils } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { logout } from '../features/auth/authActions'
import { navigationGroups } from '../config/navigation'
import { useAuthStore } from '../stores/authStore'

export function AppLayout() {
  const user = useAuthStore((state) => state.user)
  const { pathname } = useLocation()
  return (
    <div className="recipe-app">
      <aside className="recipe-sidebar">
        <div className="recipe-brand">
          <span>
            <Utensils size={17} />
          </span>
          레시피
        </div>
        <nav className="recipe-nav" aria-label="메인 메뉴">
          {navigationGroups.map((group) => (
            <div className="recipe-navgroup" key={group.id}>
              {group.label && (
                <div className="recipe-navlabel">{group.label}</div>
              )}
              {group.items.map(({ icon: Icon, label, path }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `recipe-navlink ${isActive || (path === '/orders' && pathname === '/print') ? 'is-active' : ''}`
                  }
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="recipe-account">
          <span>{user?.email}</span>
          <button type="button" onClick={() => void logout()}>
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      </aside>
      <main className="recipe-main">
        <Suspense fallback={<div className="prep-empty">불러오는 중...</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
