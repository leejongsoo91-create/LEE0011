// 중앙관제 "최근 에이전트 작업"에 보여 줄 작업 문장.
// Plaud 작업은 문장 앞부분이 모두 같아(api/_agents/plaudTrigger.js) 잘리면 구별이 안 되므로 화면에서만 줄인다.
// 저장된 query는 바꾸지 않는다.
const PLAUD_PREFIX = 'Plaud 회의 녹음을 업무 탭에 넣기:'

export function taskLabel(query) {
  const text = String(query ?? '').trim()
  if (!text.startsWith(PLAUD_PREFIX)) return text
  const title = text.slice(PLAUD_PREFIX.length).trim()
  return title ? `회의 녹음: ${title}` : '회의 녹음'
}
