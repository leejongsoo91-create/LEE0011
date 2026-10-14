import { useLocation } from 'react-router-dom'
import { navItems } from './navItems.js'

// 현재 경로에 맞는 페이지 타이틀을 보여주는 상단 헤더
export default function Header() {
  const { pathname } = useLocation()
  const currentItem = navItems.find((item) => item.to === pathname) ?? navItems[0]

  return (
    <header className="sticky top-0 z-20 border-b border-gray-700 bg-gray-900/90 px-4 py-4 backdrop-blur lg:px-8">
      <h1 className="text-xl font-bold text-white">{currentItem.label}</h1>
    </header>
  )
}
