import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// 앱을 열어 둔 채 새 배포가 나가면, 나눠 둔 화면 파일의 옛 이름을 못 찾을 수 있다.
// 그때 한 번만 새로고침해서 새 파일을 받는다. (10초 안에 또 실패하면 무한 새로고침을 막기 위해 멈춘다)
window.addEventListener('vite:preloadError', (event) => {
  const key = 'chunk-reload-at'
  let last = 0
  try {
    last = Number(sessionStorage.getItem(key)) || 0
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    // 저장소를 못 쓰는 환경이면 그냥 한 번 새로고침한다.
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
