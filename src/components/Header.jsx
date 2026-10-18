import Breadcrumb from './Breadcrumb.jsx'
import ThemeToggle from './ThemeToggle.jsx'

// 빵부스러기와 테마 전환 버튼을 가진 상단 헤더
export default function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-[61px] items-center justify-between gap-3 border-b border-gray-700 bg-gray-900/90 px-4 backdrop-blur lg:px-8">
      <Breadcrumb />
      <ThemeToggle />
    </header>
  )
}
