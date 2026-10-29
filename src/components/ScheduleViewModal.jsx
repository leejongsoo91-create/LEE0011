import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { deleteRow, notifyDataChange } from '../lib/db.js'
import { openItemEditor } from '../utils/itemEditor.js'
import { formatKoreanDate, formatKoreanTime } from '../utils/dateFormat.js'

// 달력의 일정을 두 번 눌렀을 때 뜨는 모달: 제목, 날짜, 시간을 보여주고 수정·삭제할 수 있다.
// (폰에서는 좁은 일정 칩에 삭제 버튼을 둘 수 없어서 삭제를 여기에서 한다.)
export default function ScheduleViewModal({ row, onClose }) {
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // 상세 모달을 닫고, 같은 일정이 채워진 편집 모달(추가 모달의 편집 모드)을 연다.
  const handleEdit = () => {
    onClose()
    openItemEditor('schedule', row)
  }

  const handleDelete = async () => {
    if (isDeleting || !window.confirm('정말 삭제하시겠습니까?')) return
    setIsDeleting(true)
    try {
      await deleteRow('schedule', row.id)
      notifyDataChange()
      toast('삭제했습니다')
      onClose()
    } catch {
      toast.error('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요')
      setIsDeleting(false)
    }
  }

  const details = [
    { label: '날짜', value: formatKoreanDate(row.date) },
    { label: '시간', value: formatKoreanTime(row.time) },
    ...(row.agent_task
      ? [{ label: '에이전트', value: `${row.agent_task} (${row.agent_before_min ? `${row.agent_before_min}분 전` : '정시'}에 결재 요청)` }]
      : []),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="배경 클릭으로 닫기"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-view-title"
        className="relative flex w-full max-w-md flex-col gap-5 rounded-2xl bg-gray-800 p-6"
      >
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-400">일정 상세</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <p id="schedule-view-title" className="break-words text-2xl font-bold text-white">
          {row.title || '제목 없음'}
        </p>
        <dl className="flex flex-col gap-3 text-sm">
          {details.map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-4 border-t border-gray-700 pt-3">
              <dt className="w-14 shrink-0 text-gray-400">{label}</dt>
              <dd className="min-w-0 break-words text-gray-100">{value}</dd>
            </div>
          ))}
        </dl>
        <footer className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEdit}
              disabled={isDeleting}
              className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              수정
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-white"
            >
              닫기
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
