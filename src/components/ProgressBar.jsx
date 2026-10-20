// 진행률(0~100)을 5단계 너비로 보여주는 얇은 막대 (Tailwind 클래스는 전체 이름으로 적는다)
function widthClass(progress) {
  if (progress <= 0) return 'w-0'
  if (progress <= 25) return 'w-1/4'
  if (progress <= 50) return 'w-1/2'
  if (progress <= 75) return 'w-3/4'
  return 'w-full'
}

export default function ProgressBar({ progress = 0 }) {
  const value = Math.min(100, Math.max(0, Number(progress) || 0))

  return (
    <div
      role="progressbar"
      aria-label="진행률"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700"
    >
      <div className={`h-full rounded-full bg-indigo-500 transition-all ${widthClass(value)}`} />
    </div>
  )
}
