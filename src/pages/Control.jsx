import { RefreshCw } from 'lucide-react'
import ControlCard from '../components/ControlCard.jsx'
import { AttentionList, RecentTasks } from '../components/ControlLists.jsx'
import useControlSummary from '../hooks/useControlSummary.js'
import useRows from '../hooks/useRows.js'
import { buildControlCards } from '../utils/controlCards.js'
import { formatAt } from '../utils/controlTime.js'

// 중앙관제: 영역별로 진행 중·대기·확인 필요를 한 화면에서 본다. (보기 전용, 결재는 텔레그램에서)
//   에이전트 카드·확인 필요·최근 작업 → /api/control-summary (서버가 agent_tasks를 요약)
//   업무·일정·주식 카드 → 브라우저가 Supabase에서 직접 (RLS로 내 것만)

const newest = (rows) => rows.reduce((max, row) => (row.created_at > max ? row.created_at : max), '')

export default function Control() {
  const summary = useControlSummary()
  const work = useRows('work')
  const schedule = useRows('schedule')
  const investments = useRows('investments')
  const agent = summary.data

  const cards = buildControlCards({ summary, work, schedule, investments })
  const lastChange = [agent?.updatedAt ?? '', newest(work.rows), newest(schedule.rows), newest(investments.rows)].sort().at(-1)

  const reloadAll = () => [summary, work, schedule, investments].forEach((source) => source.reload())

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">중앙관제</h2>
          <p className="mt-1 text-sm text-gray-400 tabular-nums">
            영역 {cards.length} · 마지막 변화 {lastChange ? formatAt(lastChange) : '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={reloadAll}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          새로고침
        </button>
      </header>

      <section aria-labelledby="control-overview" className="flex flex-col gap-3">
        <h3 id="control-overview" className="text-lg font-semibold text-white">
          전체 현황 <span className="ml-1 text-sm font-normal text-gray-400">진행 중 · 대기 · 확인 필요</span>
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <ControlCard key={card.title} {...card} />
          ))}
        </div>
        {summary.error && !agent && (
          <p className="text-sm text-gray-400">에이전트 요약을 불러오지 못했습니다. 잠시 뒤 새로고침해 주세요.</p>
        )}
      </section>

      <AttentionList summary={agent} />
      <RecentTasks summary={agent} />
    </div>
  )
}
