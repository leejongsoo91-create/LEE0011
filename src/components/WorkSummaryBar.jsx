import useRows from '../hooks/useRows.js'
import { kstDate } from '../utils/controlTime.js'
import { filterOpenWork, recentMeetings } from '../utils/today.js'

// 업무 탭 맨 위 요약 띠: 할 일 · 진행 중 · 오늘·지난 마감 · 최근 7일 회의.
// 숫자를 누르면 아래 목록이 그 항목만 보이고(show), 다시 누르면 풀린다 (보고서 11 2단계).
// 남은 할 일·회의 기록과 같은 표를 읽지만, 동시에 부르면 요청 하나를 같이 쓴다 (lib/db.js listRows).
export default function WorkSummaryBar({ show, onToggle }) {
  const work = useRows('work')
  const meetings = useRows('work_meetings')
  const loading = work.isLoading || meetings.isLoading
  const today = kstDate()
  // 개수는 아래 "남은 할 일" 목록과 같은 함수로 세서 누르면 그 수만큼 보인다
  const count = (key) => filterOpenWork(work.rows, key, today).length
  const due = count('due')
  const items = [
    { key: 'todo', label: '할 일', value: count('todo') },
    { key: 'doing', label: '진행 중', value: count('doing') },
    { key: 'due', label: '오늘·지난 마감', value: due, warn: due > 0 },
    { key: 'meetings', label: '최근 7일 회의', value: recentMeetings(meetings.rows).length },
  ]
  return (
    <section aria-label="업무 요약" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => {
        const active = show === item.key
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            aria-busy={loading}
            onClick={() => onToggle(item.key)}
            className={`rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-300 ${
              active ? 'border-gray-300 bg-gray-700' : 'border-gray-700 bg-gray-800 hover:border-gray-500'
            }`}
          >
            <p className="text-xs text-gray-400">{item.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${item.warn ? 'text-amber-700 dark:text-amber-400' : 'text-white'}`}>
              {loading ? '—' : item.value}
            </p>
          </button>
        )
      })}
    </section>
  )
}
