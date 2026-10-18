import { Plus } from 'lucide-react'

// 우측 하단 고정 플로팅 버튼. 모바일에서는 하단 탭(높이 64px) 위로 띄운다.
export default function Fab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="새 항목 추가"
      className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-[white] shadow-lg transition-colors hover:bg-indigo-400 lg:bottom-6 lg:right-6"
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </button>
  )
}
