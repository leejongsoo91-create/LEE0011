import Skeleton from './Skeleton.jsx'
import EmptyState from './EmptyState.jsx'
import { X } from 'lucide-react'
import useRowDelete from '../hooks/useRowDelete.js'
import useRows from '../hooks/useRows.js'

const weekdays = ['일', '월', '화', '수', '목', '금', '토']
const pad = (value) => String(value).padStart(2, '0')

// 이번 달 1일 앞의 빈 칸(일요일 시작 기준)과 날짜 목록을 만든다.
function buildCells(year, month) {
  const offset = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const blanks = Array.from({ length: offset }, () => null)
  const dates = Array.from({ length: lastDate }, (_, index) => index + 1)
  return [...blanks, ...dates]
}

// 월간 달력 그리드. schedule 테이블의 일정이 해당 날짜 칸에 표시된다.
export default function CalendarGrid() {
  const { rows, setRows, isLoading } = useRows('schedule')
  const handleDelete = useRowDelete('schedule', setRows)
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const cells = buildCells(year, month)

  // 그 날의 일정을 시간순으로 정렬한다. (시간이 없는 종일 일정이 맨 앞)
  const eventsOf = (date) =>
    rows
      .filter((row) => row.date === `${year}-${pad(month + 1)}-${pad(date)}`)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))

  return (
    <section aria-label="월간 달력" className="mx-auto max-w-4xl pb-8">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-bold text-gray-100">
          {year}년 {month + 1}월
        </h2>
        {isLoading && <Skeleton className="h-4 w-24" />}
      </div>
      <div className="grid grid-cols-7 gap-1 lg:gap-2">
        {weekdays.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-medium text-gray-500">
            {day}
          </div>
        ))}
        {cells.map((date, index) =>
          date === null ? (
            <div key={`blank-${index}`} aria-hidden="true" />
          ) : (
            <div
              key={date}
              className={`flex min-h-16 min-w-0 flex-col gap-1 rounded-lg border bg-gray-800 p-1.5 text-xs text-gray-300 lg:min-h-24 lg:p-2 lg:text-sm ${
                date === today.getDate() ? 'border-gray-400 text-white' : 'border-gray-700'
              }`}
            >
              {date}
              {eventsOf(date).slice(0, 2).map((row) => (
                <span key={row.id} className="flex items-center gap-0.5 rounded bg-indigo-500/20 px-1 text-[10px] text-indigo-300 lg:text-xs">
                  <span className="min-w-0 flex-1 truncate">
                    {row.time && <span className="mr-1 text-indigo-200/70">{row.time.slice(0, 5)}</span>}
                    {row.title || '제목 없음'}
                  </span>
                  <button
                    type="button"
                    aria-label={`${row.title || '제목 없음'} 삭제`}
                    onClick={() => handleDelete(row.id)}
                    className="shrink-0 rounded text-indigo-300/60 hover:text-red-400"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          ),
        )}
      </div>
      {!isLoading && rows.length === 0 && (
        <div className="mt-4">
          <EmptyState message="아직 등록된 항목이 없습니다" hint="오른쪽 아래 + 버튼을 눌러 Schedule 페이지에서 일정을 추가해 보세요." />
        </div>
      )}
    </section>
  )
}
