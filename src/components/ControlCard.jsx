import { Link } from 'react-router-dom'

export const ATTENTION_TEXT = 'text-amber-700 dark:text-amber-400'

// 중앙관제의 영역 카드: 큰 숫자(main), 작은 줄(sub), 하위 항목(items), 맨 아래 확인 필요 개수.
// to가 있으면 카드를 눌러 해당 페이지로 이동한다. '#'으로 시작하면 같은 화면의 그 칸으로 부드럽게 내려간다.
export default function ControlCard({ title, icon: Icon, to, main, sub, items, attention, isLoading }) {
  const hasAttention = attention > 0
  const isSection = to?.startsWith('#')
  const Box = !to ? 'div' : isSection ? 'a' : Link
  const scrollToSection = (event) => {
    // Ctrl·⌘·Shift 클릭이나 가운데 버튼은 브라우저 기본 동작(새 탭 등)에 맡긴다
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    const target = document.getElementById(to.slice(1))
    if (!target) return
    event.preventDefault()
    // 기기에서 '동작 줄이기'를 켜 두었으면 부드러운 스크롤 없이 바로 이동
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }
  return (
    <Box
      {...(!to ? {} : isSection ? { href: to, onClick: scrollToSection } : { to })}
      className="flex flex-col gap-2 rounded-xl border border-gray-700 bg-gray-800 p-5 transition-colors hover:border-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-white">
        <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
        {title}
      </h2>
      {isLoading ? (
        <div className="h-16 animate-pulse rounded bg-gray-700" />
      ) : (
        <>
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tabular-nums">{main.value}</span>
            <span className="text-sm text-gray-400">{main.label}</span>
          </p>
          <p className="text-sm text-gray-400 tabular-nums">{sub}</p>
          <p className="min-h-5 truncate text-sm text-gray-400">{items || ' '}</p>
        </>
      )}
      <p className={`mt-auto flex items-center gap-2 border-t border-gray-700 pt-3 text-sm ${hasAttention ? `font-semibold ${ATTENTION_TEXT}` : 'text-gray-400'}`}>
        <span className={`h-2 w-2 rounded-full ${hasAttention ? 'bg-amber-500' : 'bg-gray-600'}`} aria-hidden="true" />
        {attention == null ? '확인 필요 —' : hasAttention ? `확인 필요 ${attention}` : '확인 필요 없음'}
      </p>
    </Box>
  )
}
