import { House, Radar, CalendarDays, Briefcase, Palette, TrendingUp } from 'lucide-react'

// 메뉴 묶음: 메뉴 패널의 탭, 빠른 검색의 묶음 제목, 경로 표시에 쓴다.
export const navGroups = [
  { id: 'workspace', label: '워크스페이스' },
  { id: 'manage', label: '관리' },
]

// 메뉴 패널(WorkspaceMenu), 빠른 검색, 경로 표시가 함께 사용하는 메뉴 목록
export const navItems = [
  { to: '/', label: '홈', icon: House, group: 'workspace' },
  { to: '/schedule', label: '일정', icon: CalendarDays, group: 'workspace' },
  { to: '/work', label: '업무', icon: Briefcase, group: 'workspace' },
  { to: '/hobbies', label: '취미', icon: Palette, group: 'workspace' },
  { to: '/investments', label: '주식', icon: TrendingUp, group: 'workspace' },
  { to: '/control', label: '관제', icon: Radar, group: 'manage' },
]

export const itemsOf = (groupId) => navItems.filter((item) => item.group === groupId)

// 주소에 맞는 메뉴 (없으면 null)
export const navItemOf = (pathname) => navItems.find((item) => item.to === pathname) ?? null
