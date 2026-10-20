// 불러오는 동안 보여주는 반짝이는 자리 표시 막대
export default function Skeleton({ className = 'h-4 w-full' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-gray-700/60 ${className}`} />
}
