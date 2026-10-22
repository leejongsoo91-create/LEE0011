import { Inbox } from 'lucide-react'

// 데이터가 하나도 없을 때 보여주는 안내 문구
export default function EmptyState({ message, hint }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-700 px-4 py-8 text-center">
      <Inbox className="h-6 w-6 text-gray-600" aria-hidden="true" />
      <p className="text-sm font-medium text-gray-300">{message}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}
