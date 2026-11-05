// Vercel 함수: 중앙관제 화면(/control)에 에이전트 작업 요약을 준다. (보기 전용)
// agent_tasks는 RLS 정책이 없는 서버 전용 표라서, 브라우저 대신 이 함수가 서비스 롤 키로 읽고 요약만 돌려준다.
//
// 보안:
//   1) GET만 → 그 밖은 405
//   2) Authorization: Bearer <Supabase 로그인 토큰>을 Supabase Auth로 확인 → 없거나 틀리면 401
//   3) 그 사용자가 대시보드 주인(owner.js: AGENT_USER_ID 또는 유일한 사용자)이 아니면 403
//   4) 응답에는 개수와 짧은 목록만. 계획 원문·인자·로그 전체·키는 담지 않는다
// 필요한 환경변수(Vercel에만): SUPABASE_SERVICE_ROLE_KEY, (선택) AGENT_USER_ID. 새로 넣을 값은 없다.

import { loadControlSummary } from './_agents/control.js'
import { ownerUserId } from './_agents/owner.js'

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method-not-allowed' })
  }

  try {
    const userId = await userIdFromToken(req.headers?.authorization)
    if (!userId) return res.status(401).json({ error: 'unauthorized' })
    if (userId !== (await ownerUserId())) return res.status(403).json({ error: 'forbidden' })

    return res.status(200).json(await loadControlSummary())
  } catch (error) {
    console.error('[control-summary] 요약 실패', error?.message)
    return res.status(500).json({ error: 'summary-failed' })
  }
}
