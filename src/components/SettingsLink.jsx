import { NavLink } from 'react-router-dom'
import { Settings } from 'lucide-react'

// 헤더의 톱니바퀴 아이콘. 설정(계정) 페이지로 이동한다.
export default function SettingsLink() {
  return (
    <NavLink
      to="/settings"
      aria-label="설정"
      className={({ isActive }) =>
        `-my-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-gray-700/50 hover:text-white ${
          isActive ? 'text-white' : 'text-gray-400'
        }`
      }
    >
      <Settings className="h-5 w-5" aria-hidden="true" />
    </NavLink>
  )
}
