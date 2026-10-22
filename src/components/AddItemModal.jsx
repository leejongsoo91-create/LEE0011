import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import TitleInput from './TitleInput.jsx'
import NotionEditor from './NotionEditor.jsx'
import InvestmentFields from './InvestmentFields.jsx'
import ScheduleFields from './ScheduleFields.jsx'
import useItemSave from '../hooks/useItemSave.js'

// 노션 페이지처럼 큰 제목 입력칸과 블록 에디터를 가진 빠른 추가/편집 모달.
// editing을 주면 기존 항목을 불러와 수정한다. 닫기 버튼, 배경 클릭, ESC 키로 닫을 수 있다.
export default function AddItemModal({ onClose, editing, prefill }) {
  const [title, setTitle] = useState(editing?.row.title ?? '')
  const [schedule, setSchedule] = useState(() => ({ date: prefill?.date ?? new Date().toLocaleDateString('sv-SE'), time: '', remind: '0' }))
  const [investment, setInvestment] = useState({ ticker: '', avg_price: '', quantity: '' })
  const contentRef = useRef(null)
  const { table, save, isSaving } = useItemSave({ editing, onSaved: onClose })

  useEffect(() => {
    // 에디터가 ESC를 먼저 처리하므로 캡처 단계에서 슬래시 메뉴가 열려 있는지 확인한다.
    // 메뉴가 열려 있으면 메뉴만 닫히고, 아니면 모달을 닫는다.
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('.bn-suggestion-menu')) return
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

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
        aria-labelledby="add-item-title"
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl bg-gray-800 p-6"
      >
        <header className="flex items-center justify-between">
          <h2 id="add-item-title" className="text-sm font-medium text-gray-400">
            {editing ? '항목 편집' : '새 항목 추가'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <TitleInput size="modal" defaultValue={title} onValueChange={setTitle} />
        {table === 'schedule' ? (
          <ScheduleFields values={schedule} onChange={setSchedule} />
        ) : table === 'investments' ? (
          <InvestmentFields values={investment} onChange={setInvestment} />
        ) : (
          <section aria-label="내용" className="min-h-48">
            <NotionEditor
              initialContent={editing?.row.content}
              onDocumentChange={(doc) => (contentRef.current = doc)}
            />
          </section>
        )}
        <footer className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => save({ title, schedule, investment, content: contentRef.current })}
            disabled={isSaving}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </footer>
      </section>
    </div>
  )
}
