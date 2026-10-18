import { readStorage, writeStorage } from './storage.js'

const themeKey = 'theme'

// 저장된 테마를 읽는다. 기본값은 다크 모드.
export function getSavedTheme() {
  return readStorage(themeKey) === 'light' ? 'light' : 'dark'
}

// html 요소의 dark 클래스를 켜고 끄고, 선택을 저장한 뒤 변경을 알린다.
export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  writeStorage(themeKey, theme)
  window.dispatchEvent(new Event('themechange'))
}
