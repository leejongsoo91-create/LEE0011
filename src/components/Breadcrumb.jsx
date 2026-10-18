import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { navItems } from './navItems.js'
import { loadTitle } from '../utils/pageTitle.js'

const linkClass = 'shrink-0 text-gray-400 transition-colors hover:text-white'

// 'Home > Work > 현재 제목' 형태의 빵부스러기 내비게이션
export default function Breadcrumb() {
  const { pathname } = useLocation()
  const [title, setTitle] = useState(() => loadTitle(pathname))
  const currentItem = navItems.find((item) => item.to === pathname) ?? navItems[0]
  const isHome = currentItem.to === '/'

  useEffect(() => {
    const sync = () => setTitle(loadTitle(pathname))
    sync()
    window.addEventListener('titlechange', sync)
    return () => window.removeEventListener('titlechange', sync)
  }, [pathname])

  return (
    <nav aria-label="빵부스러기" className="min-w-0">
      <h1 className="sr-only">{currentItem.label}</h1>
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {isHome ? (
          <li aria-current="page" className="font-semibold text-white">Home</li>
        ) : (
          <>
            <li className={linkClass}><Link to="/">Home</Link></li>
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
