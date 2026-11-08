import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import { itemsOf, navGroups, navItemOf } from './navItems.js'

// 헤더 오른쪽의 메뉴 버튼. 누르면 아래로 메뉴 패널이 열린다.
// 패널 위쪽 탭: 워크스페이스(홈·일정·업무·취미·주식) / 관리(관제)
// 메뉴를 고르거나, 바깥을 누르거나, Esc를 누르면 닫힌다.
// 패널은 헤더 오른쪽 버튼 묶음(relative)의 오른쪽 끝에 맞춰 열린다. 폰에서 왼쪽으로 넘치지 않게.
export default function WorkspaceMenu() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('workspace')
  const { pathname } = useLocation()
  const boxRef = useRef(null)
  const buttonRef = useRef(null)

  // 주소가 바뀌면(메뉴를 골랐으면) 닫는다.
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const handlePointer = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // 열 때는 지금 보는 화면이 있는 탭을 먼저 보여 준다.
  const toggle = () => {
    if (!open) setTab(navItemOf(pathname)?.group ?? 'workspace')
    setOpen((prev) => !prev)
  }

  return (
    <div ref={boxRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label="메뉴"
        aria-expanded={open}
        aria-controls="workspace-menu"
        className={`-my-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-gray-700/50 hover:text-white ${
          open ? 'bg-gray-700/50 text-white' : 'text-gray-400'
        }`}
      >
        <LayoutGrid className="h-5 w-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          id="workspace-menu"
          className="absolute right-0 top-full z-40 mt-3 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-2xl"
        >
          <p className="px-4 pt-4 pb-3 text-base font-bold tracking-tight text-white">내 대시보드</p>
          <div role="tablist" aria-label="메뉴 묶음" className="flex gap-1 border-b border-gray-700 px-3">
            {navGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={tab === group.id}
                onClick={() => setTab(group.id)}
                className={`-mb-px border-b-2 px-2 py-2 text-sm font-medium transition-colors ${
                  tab === group.id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>
          <nav role="tabpanel" aria-label={navGroups.find((group) => group.id === tab)?.label} className="flex flex-col gap-1 p-2">
            {itemsOf(tab).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                  }`
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}
