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

  // 데이터 관리 탭에서 숨긴 기록은 관제 현황판에 보이지 않는다 (SQL 실행 전에는 hidden 칸이 없어 모두 보임)
  return { ...log, rows: log.rows.filter((row) => row.hidden !== true), now }
}
