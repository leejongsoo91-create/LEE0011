import { Plus } from 'lucide-react'

// 우측 하단 고정 플로팅 버튼. 폰은 화면 아래 안전 영역(홈 표시줄) 위로 띄운다.
export default function Fab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="새 항목 추가"
      className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-[white] shadow-lg transition-colors hover:bg-indigo-400 lg:bottom-6 lg:right-6"
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </button>
  )
}
