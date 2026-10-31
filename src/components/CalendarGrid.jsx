import Skeleton from './Skeleton.jsx'
import EmptyState from './EmptyState.jsx'
import { useState } from 'react'
import { Bot, ChevronLeft, ChevronRight, X } from 'lucide-react'
import useRowDelete from '../hooks/useRowDelete.js'
import useRows from '../hooks/useRows.js'
import useDoubleTap from '../hooks/useDoubleTap.js'
import { openAddModal, openDayList, openScheduleView } from '../utils/itemEditor.js'
import { hasHolidayData, holidayOf, monthHolidays } from '../utils/holidays.js'

const weekdays = ['일', '월', '화', '수', '목', '금', '토']
const pad = (value) => String(value).padStart(2, '0')
// 일요일·공휴일은 빨강, 토요일은 파랑 (라이트 테마에서는 더 진한 색)
const RED = 'text-red-600 dark:text-red-400'
const BLUE = 'text-sky-600 dark:text-sky-400'
const dayColor = (weekday, isHoliday) => (isHoliday || weekday === 0 ? RED : weekday === 6 ? BLUE : '')

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
  const isDoubleTap = useDoubleTap()
  const today = new Date()
  // 보고 있는 달 (처음엔 이번 달). 달을 넘어가도 Date가 연도를 알아서 맞춰 준다.
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const { year, month } = view
  const isThisMonth = year === today.getFullYear() && month === today.getMonth()
  const moveMonth = (delta) => {
    const next = new Date(year, month + delta, 1)
    setView({ year: next.getFullYear(), month: next.getMonth() })
  }
  const cells = buildCells(year, month)
  // 이달의 공휴일 (연휴는 하나로 묶음). 공휴일 표가 없는 해는 안내만 한다.
  const holidaysThisMonth = monthHolidays(year, month)
  const knownYear = hasHolidayData(year)

  // 그 날의 일정을 시간순으로 정렬한다. (시간이 없는 종일 일정이 맨 앞)
  const dateString = (date) => `${year}-${pad(month + 1)}-${pad(date)}`
  const eventsOf = (date) =>
    rows
      .filter((row) => row.date === dateString(date))
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))

  return (
    <section aria-label="월간 달력" className="mx-auto max-w-4xl pb-8">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달" className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="min-w-28 text-center text-xl font-bold text-gray-100" aria-live="polite">
          {year}년 {month + 1}월
        </h2>
        <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달" className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
        {!isThisMonth && (
          <button type="button" onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })} className="rounded-lg border border-gray-600 px-2.5 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700">
            오늘
          </button>
        )}
        {isLoading && <Skeleton className="h-4 w-24" />}
      </div>
      <p className="-mt-2 mb-4 text-xs text-gray-400">날짜 칸을 두 번 누르면 일정 추가, 일정을 두 번 누르면 상세 보기·삭제</p>
      <div className="grid grid-cols-7 gap-1 lg:gap-2">
        {weekdays.map((day, index) => (
          <div key={day} className={`py-2 text-center text-xs font-medium ${dayColor(index, false) || 'text-gray-400'}`}>
            {day}
          </div>
        ))}
        {cells.map((date, index) => {
          if (date === null) return <div key={`blank-${index}`} aria-hidden="true" />
          const holiday = holidayOf(dateString(date))
          const color = dayColor(index % 7, Boolean(holiday))
          return (
            <div
              key={date}
              onClick={(event) => isDoubleTap(`day-${date}`, event.timeStamp) && openAddModal({ date: dateString(date) })}
              className={`touch-manipulation select-none flex min-h-16 min-w-0 flex-col gap-1 rounded-lg border bg-gray-800 p-1.5 text-xs text-gray-300 lg:min-h-24 lg:p-2 lg:text-sm ${
                isThisMonth && date === today.getDate() ? 'border-gray-400 text-white' : 'border-gray-700'
              }`}
            >
              {/* 폰처럼 칸이 좁으면 공휴일 이름을 날짜 아래 줄에, 넓으면 같은 줄에 */}
              <span className={`flex min-w-0 flex-col lg:flex-row lg:items-baseline lg:gap-1 ${color}`}>
                <span className="shrink-0">{date}</span>
                {holiday && (
                  <span className="min-w-0 truncate text-[10px] leading-tight lg:text-xs" title={holiday}>
                    {holiday}
                  </span>
                )}
              </span>
              {eventsOf(date).slice(0, 2).map((row) => (
                <span
                  key={row.id}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (isDoubleTap(`event-${row.id}`, event.timeStamp)) openScheduleView(row)
                  }}
                  className="flex cursor-pointer items-center gap-0.5 rounded bg-indigo-500/20 px-1 text-[10px] text-indigo-300 lg:text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {row.agent_task && <Bot className="mr-0.5 inline h-2.5 w-2.5 lg:h-3 lg:w-3" aria-label="에이전트 작업 있음" />}
                    {row.time && <span className="mr-1 text-indigo-200/70">{row.time.slice(0, 5)}</span>}
                    {row.title || '제목 없음'}
                  </span>
                  <button
                    type="button"
                    aria-label={`${row.title || '제목 없음'} 삭제`}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDelete(row.id)
                    }}
                    className="hidden shrink-0 rounded text-indigo-300/60 hover:text-red-400 lg:block"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {eventsOf(date).length > 2 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    openDayList(dateString(date))
                  }}
                  className="rounded px-1 text-left text-[10px] text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200 lg:text-xs"
                >
                  +{eventsOf(date).length - 2}개
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        {!knownYear ? (
          '이 해의 공휴일은 아직 등록되지 않았어요'
        ) : holidaysThisMonth.length === 0 ? (
          '이달의 공휴일: 없음'
        ) : (
          <>
            이달의 공휴일:{' '}
            {holidaysThisMonth.map((h, i) => (
              <span key={h.start} className={RED}>
                {i > 0 && <span className="text-gray-400"> · </span>}
                {month + 1}/{h.start}
                {h.end > h.start && `~${h.end}`} {h.name}
              </span>
            ))}
          </>
        )}
      </p>
      {!isLoading && rows.length === 0 && (
        <div className="mt-4">
          <EmptyState message="아직 등록된 항목이 없습니다" hint="오른쪽 아래 + 버튼을 눌러 Schedule 페이지에서 일정을 추가해 보세요." />
        </div>
      )}
    </section>
  )
}
