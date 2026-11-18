import { Link } from 'react-router-dom'
import DataState from './DataState.jsx'
import useRows from '../hooks/useRows.js'
import { kstDate } from '../utils/controlTime.js'
import { openScheduleView } from '../utils/itemEditor.js'
import { dueLabel, dueWork, openWork, todaySchedule, weekScheduleCount } from '../utils/today.js'

const warnText = 'text-amber-700 dark:text-amber-400'
// 마감 목록은 이만큼만 보이고 나머지는 업무 탭으로 (폰에서 칸이 길어지지 않게)
const DUE_LIMIT = 5

// 홈 맨 위 "오늘" 칸 (보고서 11): 오늘 일정, 오늘 마감·지난 마감 업무(5건까지), 남은 할 일·7일 안 일정 수.
// 일정을 누르면 일정 보기 창, 업무를 누르면 업무 상세로 간다.
export default function TodayPanel() {
  const schedule = useRows('schedule')
  const work = useRows('work')
  const today = kstDate()
  const events = todaySchedule(schedule.rows, today)
  const due = dueWork(work.rows, today)
  const openCount = openWork(work.rows).length
  const weekCount = weekScheduleCount(schedule.rows, today)
  const loading = schedule.isLoading || work.isLoading

  return (
    <section aria-label="오늘" className="flex flex-col gap-4 rounded-xl bg-gray-800 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold text-white">오늘</h2>
        <p className="text-xs text-gray-400 tabular-nums">
          {loading ? '—' : `남은 할 일 ${openCount}건 · 7일 안 일정 ${weekCount}건`}
        </p>
      </div>
      <DataState isLoading={loading} isEmpty={false} skeletonRows={2}>
        <div className="grid grid-cols-1 gap-4 text-sm lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="text-xs font-semibold text-gray-400">일정</h3>
            {events.length === 0 ? (
              <p className="text-gray-500">오늘 일정 없음</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {events.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openScheduleView(row)}
                      className="flex w-full min-w-0 gap-3 rounded px-1 py-0.5 text-left hover:bg-gray-700/50"
                    >
                      <span className="w-11 shrink-0 text-gray-400 tabular-nums">{row.time ? row.time.slice(0, 5) : '종일'}</span>
                      <span className="min-w-0 flex-1 truncate text-gray-100">{row.title || '제목 없음'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="text-xs font-semibold text-gray-400">마감</h3>
            {due.length === 0 ? (
              <p className="text-gray-500">오늘 마감인 업무 없음</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {due.slice(0, DUE_LIMIT).map((row) => (
                  <li key={row.id}>
                    <Link to={`/work/${row.id}`} className="flex min-w-0 gap-3 rounded px-1 py-0.5 hover:bg-gray-700/50">
                      <span className="min-w-0 flex-1 truncate text-gray-100">{row.title || '제목 없음'}</span>
                      <span className={`shrink-0 text-xs ${row.overdue > 0 ? warnText : 'text-gray-400'}`}>{dueLabel(row.due_date, today)}</span>
                    </Link>
                  </li>
                ))}
                {due.length > DUE_LIMIT && (
                  <li>
                    <Link to="/work" className="px-1 text-xs text-gray-400 underline hover:text-white">
                      외 {due.length - DUE_LIMIT}건 업무 탭에서 보기
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </DataState>
    </section>
  )
}
