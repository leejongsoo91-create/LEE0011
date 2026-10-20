import Skeleton from './Skeleton.jsx'
import EmptyState from './EmptyState.jsx'

// 로딩 중에는 스켈레톤, 데이터가 없으면 빈 상태 안내, 있으면 children을 보여준다.
export default function DataState({ isLoading, isEmpty, message, hint, skeletonRows = 3, children }) {
  if (isLoading) {
    return (
      <div role="status" aria-label="불러오는 중" className="flex flex-col gap-2">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    )
  }
  if (isEmpty) return <EmptyState message={message} hint={hint} />
  return children
}
