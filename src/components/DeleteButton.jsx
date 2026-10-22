import { Trash2 } from 'lucide-react'

// 항목 모서리에 놓는 작은 삭제 아이콘. 눌러도 카드 클릭(편집)이나 드래그가 일어나지 않는다.
// 모바일에서는 은은하게 항상 보이고, 데스크톱에서는 항목에 마우스를 올릴 때 나타난다.
export default function DeleteButton({ onDelete, label = '삭제', className = '' }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onDelete()
      }}
      className={`rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-red-400 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 ${className}`}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}
