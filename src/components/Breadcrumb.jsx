import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { navGroups, navItems } from './navItems.js'
import { loadTitle } from '../utils/pageTitle.js'

const linkClass = 'shrink-0 text-gray-400 transition-colors hover:text-white'

// '홈 > 업무 > 현재 제목' 형태의 빵부스러기 내비게이션. 관리 메뉴는 '관리 > 관제'
export default function Breadcrumb() {
  const { pathname } = useLocation()
  const [title, setTitle] = useState(() => loadTitle(pathname))
  // 상세 화면(/work/<id>)은 위 메뉴(업무) 아래에 둔다
  const currentItem =
    navItems.find((item) => item.to === pathname) ??
    navItems.find((item) => item.to !== '/' && pathname.startsWith(`${item.to}/`)) ??
    navItems[0]
  const isSettings = pathname === '/settings'
  const isHome = currentItem.to === '/' && !isSettings
  const isManage = currentItem.group === 'manage' && !isSettings

  useEffect(() => {
    const sync = () => setTitle(loadTitle(pathname))
    sync()
    window.addEventListener('titlechange', sync)
    return () => window.removeEventListener('titlechange', sync)
  }, [pathname])

  return (
    <nav aria-label="빵부스러기" className="min-w-0">
      <h1 className="sr-only">{isSettings ? '설정' : currentItem.label}</h1>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {isHome ? (
          <li aria-current="page" className="font-semibold text-white">홈</li>
        ) : isManage ? (
          <>
            <li className="shrink-0 text-gray-400">{navGroups.find((group) => group.id === 'manage').label}</li>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" aria-hidden="true" />
            <li aria-current="page" className="font-semibold text-white">{currentItem.label}</li>
          </>
        ) : isSettings ? (
          <>
            <li className={linkClass}><Link to="/">홈</Link></li>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" aria-hidden="true" />
            <li aria-current="page" className="font-semibold text-white">설정</li>
          </>
        ) : (
          <>
            <li className={linkClass}><Link to="/">홈</Link></li>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" aria-hidden="true" />
            <li className={linkClass}><Link to={currentItem.to}>{currentItem.label}</Link></li>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" aria-hidden="true" />
            <li aria-current="page" className="truncate font-semibold text-white">
              {title.trim() || '제목 없음'}
            </li>
          </>
        )}
      </ol>
    </nav>
  )
}
