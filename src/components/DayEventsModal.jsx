import { useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import useRows from '../hooks/useRows.js'
import { openAddModal, openScheduleView } from '../utils/itemEditor.js'
import { formatKoreanDate } from '../utils/dateFormat.js'

// 달력의 '+N개'를 눌렀을 때 뜨는 모달: 그날의 모든 일정을 시간순으로 보여 준다.
// 일정을 누르면 상세 모달(수정·삭제)로 이어진다.
export default function DayEventsModal({ date, onClose }) {
  const { rows } = useRows('schedule')
  const events = rows
    .filter((row) => row.date === date)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const openEvent = (row) => {
    onClose()
    openScheduleView(row)
  }

  const addEvent = () => {
    onClose()
    openAddModal({ date })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" onClick={onClose} aria-label="배경 클릭으로 닫기" tabIndex={-1} className="absolute inset-0 cursor-default bg-black/60" />
      <section role="dialog" aria-modal="true" aria-labelledby="day-events-title" className="relative flex max-h-[80vh] w-full max-w-md flex-col gap-4 rounded-2xl bg-gray-800 p-6">
        <header className="flex items-center justify-between">
          <h2 id="day-events-title" className="text-sm font-medium text-gray-400">
            {formatKoreanDate(date)} 일정 {events.length}개
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <ul className="flex flex-col gap-2 overflow-y-auto">
          {events.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => openEvent(row)}
                className="flex w-full items-baseline gap-3 rounded-lg bg-gray-900 px-3 py-2.5 text-left text-sm text-gray-100 transition-colors hover:bg-gray-700"
              >
                <span className="w-12 shrink-0 tabular-nums text-xs text-gray-400">{row.time ? row.time.slice(0, 5) : '종일'}</span>
                <span className="min-w-0 flex-1 break-words">{row.title || '제목 없음'}</span>
              </button>
            </li>
          ))}
        </ul>
        <footer className="flex justify-between">
          <button type="button" onClick={addEvent} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700">
            <Plus className="h-4 w-4" aria-hidden="true" />
            일정 추가
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-white">
            닫기
          </button>
        </footer>
      </section>
    </div>
  )
}
