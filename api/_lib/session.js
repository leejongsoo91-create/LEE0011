// 브라우저에서 온 요청의 로그인 확인: Authorization: Bearer <Supabase 로그인 토큰> → 사용자 id.
// 중앙관제 요약(/api/control-summary)과 일정 알림(/api/notify-schedule)이 같이 쓴다.

// 로그인 토큰의 사용자 id. 확인할 수 없으면 null.
export async function userIdFromToken(authorization) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  })
  if (!response.ok) return null
  const user = await response.json().catch(() => null)
  return typeof user?.id === 'string' ? user.id : null
}
