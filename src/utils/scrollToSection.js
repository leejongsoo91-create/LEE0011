// 같은 화면 안의 칸(#id)으로 스크롤하는 링크 클릭 처리. 관제의 개발 팀 카드와 "↑ 전체 현황으로" 링크가 함께 쓴다.

// Ctrl·⌘·Shift 클릭이나 왼쪽이 아닌 버튼은 브라우저 기본 동작(새 탭 등)에 맡긴다
export const isPlainClick = (event) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)

// <a href="#id" onClick={scrollToSection}> 형태로 쓴다. 대상 칸이 없으면 기본 동작(주소에 #id)에 맡긴다.
export function scrollToSection(event) {
  if (!isPlainClick(event)) return
  const id = event.currentTarget.getAttribute('href')?.slice(1)
  const target = id && document.getElementById(id)
  if (!target) return
  event.preventDefault()
  // 기기에서 '동작 줄이기'를 켜 두었으면 부드러운 스크롤 없이 바로 이동
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}
