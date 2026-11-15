import { Plus } from 'lucide-react'
import useHideOnScroll from '../hooks/useHideOnScroll.js'

// 우측 하단 고정 플로팅 버튼. 폰은 화면 아래 안전 영역(홈 표시줄) 위로 띄운다.
// 아래로 스크롤하거나 글을 치는 동안에는 내용을 가리지 않게 숨긴다.
export default function Fab({ onClick }) {
  const hidden = useHideOnScroll()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="새 항목 추가"
      // 숨었을 때는 inert로 포커스·키보드·스크린리더에서 함께 뺀다 (포커스가 있었으면 브라우저가 풀어 준다)
      inert={hidden}
      className={`fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-[white] shadow-lg transition-[background-color,transform,opacity] duration-200 hover:bg-indigo-400 lg:bottom-6 lg:right-6 ${
        hidden ? 'pointer-events-none translate-y-24 opacity-0' : ''
      }`}
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
    </button>
  )
}
