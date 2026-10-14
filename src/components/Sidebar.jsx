import { NavLink } from 'react-router-dom'
import { navItems } from './navItems.js'

// 데스크톱(lg 이상)에서만 보이는 좌측 고정 사이드바
export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[250px] flex-col border-r border-gray-700 bg-gray-800 lg:flex">
      <p className="px-6 py-6 text-lg font-bold tracking-tight text-white">
        My Dashboard
      </p>
      <nav aria-label="메인 메뉴" className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
