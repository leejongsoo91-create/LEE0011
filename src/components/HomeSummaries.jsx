import DataState from './DataState.jsx'
import InvestmentChart from './InvestmentChart.jsx'
import useRows from '../hooks/useRows.js'

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
  const today = new Date().toLocaleDateString('sv-SE')
  const upcoming = rows.filter((row) => row.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const items = upcoming.slice(0, 3).map((row) => ({ id: row.id, label: `${row.date.slice(5)} · ${row.title || '제목 없음'}` }))
  return (
    <DataState isLoading={isLoading} isEmpty={items.length === 0} message="아직 등록된 항목이 없습니다" skeletonRows={2}>
      <TitleList items={items} />
    </DataState>
  )
}

export function WorkSummary() {
  const { rows, isLoading } = useRows('work')
  const items = rows.slice(0, 3).map((row) => ({ id: row.id, label: `${row.title || '제목 없음'} · ${statusLabels[row.status] ?? row.status}` }))
  return (
    <DataState isLoading={isLoading} isEmpty={rows.length === 0} message="아직 등록된 항목이 없습니다" skeletonRows={2}>
      <TitleList items={items} />
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
