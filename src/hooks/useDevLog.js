import { useEffect, useState } from 'react'
import useRows from './useRows.js'

// 개발 팀 작업 기록(dev_log)을 읽는다. 탭이 보일 때만 30초마다 다시 읽고, "N분 전" 표시용 현재 시각도 같이 갱신한다.
export const DEV_LOG_POLL_MS = 30_000

export default function useDevLog() {
  const log = useRows('dev_log')
  const { reload } = log
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      setNow(Date.now())
      reload()
    }
    const timer = setInterval(tick, DEV_LOG_POLL_MS)
    // 다른 탭에 있다 돌아오면 바로 새로 읽는다
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [reload])

  return { ...log, now }
}
