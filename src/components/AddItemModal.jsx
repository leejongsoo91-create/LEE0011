import { useEffect } from 'react'
import { X } from 'lucide-react'
import TitleInput from './TitleInput.jsx'

// 노션 페이지처럼 큰 제목 입력칸과 투명한 본문 입력칸을 가진 빠른 추가 모달.
// 닫기 버튼, 배경 클릭, ESC 키로 닫을 수 있다.
export default function AddItemModal({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
            새 항목 추가
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
        <TitleInput size="modal" />
        <textarea
          aria-label="내용"
          rows={8}
          placeholder="명령어를 사용하려면 '/'를 입력하세요..."
          className="w-full resize-none bg-transparent text-base text-gray-100 outline-none placeholder:text-gray-500"
        />
      </section>
    </div>
  )
}
