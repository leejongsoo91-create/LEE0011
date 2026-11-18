import DataState from './DataState.jsx'
import InvestmentChart from './InvestmentChart.jsx'
import { Link } from 'react-router-dom'
import useRows from '../hooks/useRows.js'
import { kstDate } from '../utils/controlTime.js'
import { dueLabel, openWork } from '../utils/today.js'

const statusLabels = { Todo: '할 일', 'In Progress': '진행 중', Done: '완료' }

// 제목만 간단히 나열하는 목록
function TitleList({ items }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item.id} className="truncate text-gray-200">
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function ScheduleSummary() {
  const { rows, isLoading } = useRows('schedule')
  const today = kstDate()
  const upcoming = rows.filter((row) => row.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const items = upcoming.slice(0, 3).map((row) => ({ id: row.id, label: `${row.date.slice(5)} · ${row.title || '제목 없음'}` }))
  return (
    <DataState isLoading={isLoading} isEmpty={items.length === 0} message="다가오는 일정이 없습니다" skeletonRows={2}>
      <TitleList items={items} />
    </DataState>
  )
}

// 업무 상자 (보고서 11): 끝나지 않은 업무를 마감 가까운 순으로 5건. 위에 할 일·진행 중 수.
export function WorkSummary() {
  const { rows, isLoading } = useRows('work')
  const today = kstDate()
  const open = openWork(rows)
  // 진행 중이 아니면 모두 할 일로 센다 (목록에서 상태 없는 업무를 '할 일'로 보이는 것과 맞춤)
  const doing = open.filter((row) => row.status === 'In Progress').length
  return (
    <DataState isLoading={isLoading} isEmpty={open.length === 0} message="남은 업무가 없습니다" skeletonRows={2}>
      <p className="mb-2 text-xs text-gray-400 tabular-nums">
        할 일 {open.length - doing} · 진행 중 {doing}
      </p>
      <ul className="flex flex-col gap-1.5">
        {open.slice(0, 5).map((row) => {
          const due = dueLabel(row.due_date, today)
          return (
            <li key={row.id}>
              <Link to={`/work/${row.id}`} className="flex min-w-0 gap-2 rounded hover:bg-gray-700/50">
                <span className="min-w-0 flex-1 truncate text-gray-200">{row.title || '제목 없음'}</span>
                <span className={`shrink-0 text-xs ${due.endsWith('지남') ? 'text-amber-700 dark:text-amber-400' : 'text-gray-400'}`}>
                  {due || statusLabels[row.status] || '할 일'}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </DataState>
  )
}

export function HobbiesSummary() {
  const { rows, isLoading } = useRows('hobbies')
  const items = rows.slice(0, 3).map((row) => ({ id: row.id, label: row.title || '제목 없음' }))
  return (
    <DataState isLoading={isLoading} isEmpty={rows.length === 0} message="아직 등록된 항목이 없습니다" skeletonRows={2}>
      <TitleList items={items} />
    </DataState>
  )
}

export function InvestmentsSummary() {
  const { rows, isLoading } = useRows('investments')
  return (
    <DataState isLoading={isLoading} isEmpty={rows.length === 0} message="아직 등록된 항목이 없습니다" skeletonRows={2}>
      <InvestmentChart rows={rows} />
    </DataState>
  )
}
