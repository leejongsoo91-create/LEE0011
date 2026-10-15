// 색상 톤별 클래스 (Tailwind가 인식하도록 전체 클래스명을 그대로 적는다)
const toneClasses = {
  indigo: 'bg-indigo-500/15 text-indigo-300',
  emerald: 'bg-emerald-500/15 text-emerald-300',
  gray: 'bg-gray-600/40 text-gray-300',
}

// 날짜, 티커, 상태 표시에 쓰는 작은 뱃지
export default function Badge({ tone = 'gray', children }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}
