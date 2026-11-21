import { useEffect, useState } from 'react'
import { listDevLogs, listDevWorks } from '../lib/db.js'
import { filterByAgent, periodRange, rangeToTimes } from '../utils/devWork.js'

// 작업 번호 목록을 나눠 한 줄 기록을 불러온다 (주소 길이 한도 때문에 50개씩)
async function logsFor(keys) {
  const chunks = []
  for (let i = 0; i < keys.length; i += 50) chunks.push(keys.slice(i, i + 50))
  return (await Promise.all(chunks.map((part) => listDevLogs({ keys: part })))).flat()
}

// 개발 창 "작업 정리" 탭의 데이터 (보고서 12 2단계).
//   works: 고른 기간(또는 검색어)의 작업, logs: 그 작업들의 한 줄 기록 전부(진행 줄·에이전트 거르기에 씀)
//   latest: 고른 에이전트의 가장 최근 작업 하나 (최근 작업 20개 안에서 찾음). 에이전트를 바꿔도 다시 불러오지 않는다
export default function useDevWindow({ period, anchor, agent, q, project }) {
  const { start, end } = rangeToTimes(periodRange(period, anchor))
  const [state, setState] = useState({ status: 'loading', works: [], recent: [], logs: [] })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, status: 'loading' }))
    ;(async () => {
      const [works, recent] = await Promise.all([listDevWorks(q ? { q, project } : { start, end, project }), listDevWorks({ limit: 20, project })])
      const keys = [...new Set([...works, ...recent].map((work) => work.work_key))]
      const logs = keys.length ? await logsFor(keys) : []
      return { works, recent, logs }
    })()
      .then((data) => !cancelled && setState({ status: 'ready', ...data }))
      .catch(() => !cancelled && setState((prev) => ({ ...prev, status: 'error' })))
    return () => {
      cancelled = true
    }
  }, [start, end, q, project, version])

  // 에이전트 거르기는 불러온 것 안에서 한다 (칩을 눌러도 다시 불러오지 않음)
  const shown = filterByAgent(state.works, state.logs, agent)
  const latest = filterByAgent(state.recent, state.logs, agent)[0] ?? null
  return { ...state, shown, latest, reload: () => setVersion((prev) => prev + 1) }
}
