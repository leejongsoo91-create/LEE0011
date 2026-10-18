import { Moon, Sun } from 'lucide-react'
import useTheme from '../hooks/useTheme.js'
import { applyTheme } from '../utils/theme.js'

// 해/달 아이콘으로 다크 ↔ 라이트 모드를 전환하는 버튼
export default function ThemeToggle() {
  const theme = useTheme()
  const isDark = theme === 'dark'
  const Icon = isDark ? Moon : Sun

  return (
    <button
      type="button"
      onClick={() => applyTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className="-my-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-white"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
