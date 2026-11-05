import { House, Radar, CalendarDays, Briefcase, Palette, TrendingUp } from 'lucide-react'

// 사이드바, 하단 탭, 헤더가 함께 사용하는 메뉴 목록
export const navItems = [
  { to: '/', label: '홈', icon: House },
  { to: '/control', label: '관제', icon: Radar },
  { to: '/schedule', label: '일정', icon: CalendarDays },
  { to: '/work', label: '업무', icon: Briefcase },
  { to: '/hobbies', label: '취미', icon: Palette },
  { to: '/investments', label: '투자', icon: TrendingUp },
]
