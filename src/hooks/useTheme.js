import { useEffect, useState } from 'react'

const readTheme = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

// 현재 테마('dark' 또는 'light')를 돌려주고, 바뀌면 다시 렌더링한다.
export default function useTheme() {
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    const handleChange = () => setTheme(readTheme())
    window.addEventListener('themechange', handleChange)
    return () => window.removeEventListener('themechange', handleChange)
  }, [])

  return theme
}
