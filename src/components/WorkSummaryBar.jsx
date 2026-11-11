import useRows from '../hooks/useRows.js'
import { kstDate } from '../utils/controlTime.js'
import { workSummary } from '../utils/teamStatus.js'

// 업무 탭 맨 위 요약 띠: 할 일 · 진행 중 · 오늘 마감 · 최근 7일 회의.
// 칸반·회의 기록과 같은 표를 읽지만, 동시에 부르면 요청 하나를 같이 쓴다 (lib/db.js listRows).
export default function WorkSummaryBar() {
  const work = useRows('work')
  const meetings = useRows('work_meetings')
  const loading = work.isLoading || meetings.isLoading
  const summary = workSummary(work.rows, meetings.rows, kstDate())
  const items = [
    { label: '할 일', value: summary.todo },
    { label: '진행 중', value: summary.doing },
    { label: '오늘 마감', value: summary.dueToday, warn: summary.dueToday > 0 },
    { label: '최근 7일 회의', value: summary.recentMeetings },
  ]
  return (
    <section aria-label="업무 요약" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-3">
          <p className="text-xs text-gray-400">{item.label}</p>
          <p className={`text-2xl font-bold tabular-nums ${item.warn ? 'text-amber-700 dark:text-amber-400' : 'text-white'}`}>
            {loading ? '—' : item.value}
          </p>
        </div>
      ))}
    </section>
  )
}
