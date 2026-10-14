import { NavLink } from 'react-router-dom'
import { navItems } from './navItems.js'

// 모바일에서만 보이는 하단 고정 탭 (lg 이상에서는 숨김)
export default function BottomTab() {
  return (
    <nav
      aria-label="하단 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-gray-700 bg-gray-800 lg:hidden"
    >
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-white' : 'text-gray-400 hover:text-white'
            }`
          }
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
