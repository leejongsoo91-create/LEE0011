// 오류를 텔레그램에 보여 줄 "원인 한 줄"로 바꾼다. 키·토큰 같은 비밀 값은 절대 넣지 않는다.

const cut = (text, n = 120) => {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim()
  return value.length > n ? `${value.slice(0, n)}…` : value
}

// Anthropic SDK 오류의 본문 설명 (예: "tool_choice: type ... not supported")
const apiMessage = (error) => error?.error?.error?.message ?? error?.error?.message ?? null

export function friendlyReason(error) {
  const name = error?.constructor?.name ?? error?.name ?? ''
  const status = typeof error?.status === 'number' ? error.status : null
  const message = String(error?.message ?? error ?? '')
  const detail = apiMessage(error) ?? message

  // AI (Anthropic API)
  if (/Timeout/i.test(name) || /timed? ?out/i.test(message)) return 'AI 응답이 너무 늦었어요. 잠시 뒤에 다시 보내 주세요'
  if (name === 'APIConnectionError') return 'AI 서버에 연결하지 못했어요. 잠시 뒤에 다시 보내 주세요'
  if (status === 401) return 'AI 키가 맞지 않아요 (Vercel의 ANTHROPIC_API_KEY 확인)'
  if (/credit balance/i.test(detail)) return 'AI 크레딧이 부족해요 (console.anthropic.com → Billing)'
  if (status === 404 && /model/i.test(detail)) return '이 계정에서 쓸 수 없는 모델이에요 (AGENT_MODEL 확인)'
  if (status === 429 || status === 529 || /overloaded/i.test(detail)) return 'AI 서버가 바빠요. 잠시 뒤에 다시 보내 주세요'
  if (status !== null && status >= 400) return `AI 요청 오류 (${status}): ${cut(detail)}`

  // 데이터베이스 (supabase.js가 던지는 오류)
  if (message === 'supabase-not-configured') return '데이터베이스 설정이 없어요 (Vercel의 SUPABASE 환경변수 확인)'
  const db = message.match(/^supabase-(auth-)?(\w+)$/)
  if (db) return `데이터베이스 오류 (${db[2]})`

  return cut(message) || '알 수 없는 오류'
}
