import { House, CalendarDays, Briefcase, Palette, TrendingUp } from 'lucide-react'

// 사이드바, 하단 탭, 헤더가 함께 사용하는 메뉴 목록
export const navItems = [
  { to: '/', label: 'Home', icon: House },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/work', label: 'Work', icon: Briefcase },
  { to: '/hobbies', label: 'Hobbies', icon: Palette },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
]
