import { useEffect } from 'react'
import { X } from 'lucide-react'
import { meetingTime, summaryBlocks } from '../utils/meetingSummary.js'

const headingClass = {
  1: 'text-lg font-bold text-white',
  2: 'text-base font-bold text-white',
  3: 'text-sm font-semibold text-gray-200',
}

// 회의 기록을 누르면 뜨는 모달: Plaud 요약을 읽기 전용으로 보여준다. (녹취록 전문은 저장하지 않아 Plaud 앱에서 본다)
export default function MeetingSummaryModal({ meeting, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const blocks = summaryBlocks(meeting.summary_md)

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
        aria-labelledby="meeting-view-title"
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 rounded-2xl bg-gray-800 p-6"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-gray-400">회의 기록 · {meetingTime(meeting.recorded_at) || '시각 모름'}</p>
            <h2 id="meeting-view-title" className="mt-1 break-words text-xl font-bold text-white">
              {meeting.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="-mx-2 flex flex-col gap-2 overflow-y-auto px-2 text-sm leading-relaxed text-gray-200">
          {blocks.length === 0 ? (
            <p className="text-gray-400">요약이 비어 있어요.</p>
          ) : (
            blocks.map((block, index) => <SummaryBlock key={index} block={block} />)
          )}
        </div>
        <p className="border-t border-gray-700 pt-3 text-xs text-gray-400">
          할 일은 아래 칸반 보드에 카드로 들어가 있어요. 녹취록 전문은 Plaud 앱에서 볼 수 있어요.
        </p>
      </section>
    </div>
  )
}

function SummaryBlock({ block }) {
  if (block.type === 'heading') {
    const Tag = `h${block.level + 2}`
    return <Tag className={`mt-2 break-words ${headingClass[block.level]}`}>{block.text}</Tag>
  }
  if (block.type === 'todo') {
    return (
      <p className={`flex gap-2 break-words ${block.done ? 'text-gray-400 line-through' : ''}`}>
        <span aria-hidden="true">{block.done ? '☑' : '☐'}</span>
        <span className="min-w-0">{block.text}</span>
      </p>
    )
  }
  if (block.type === 'item') {
    return (
      <p className="flex gap-2 break-words">
        <span aria-hidden="true">•</span>
        <span className="min-w-0">{block.text}</span>
      </p>
    )
  }
  if (block.type === 'quote') return <p className="break-words border-l-2 border-gray-600 pl-3 text-gray-300">{block.text}</p>
  return <p className="break-words">{block.text}</p>
}
