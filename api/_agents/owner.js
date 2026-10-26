// 대시보드 주인(캡틴)의 Supabase user_id.
// 서비스 롤 키는 RLS를 우회하므로, 일정 도구는 모든 조회·등록·삭제에 이 id 조건을 직접 붙인다. (global_rules G-4)
//   1) Vercel 환경변수 AGENT_USER_ID가 있으면 그 값
//   2) 없으면 Auth에 등록된 사용자가 정확히 1명일 때 그 사람 (혼자 쓰는 대시보드라서)

import { authAdmin } from './supabase.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
let cached = null

export async function ownerUserId() {
  if (cached) return cached
  const fromEnv = process.env.AGENT_USER_ID?.trim()
  if (fromEnv) {
    if (!UUID.test(fromEnv)) throw new Error('AGENT_USER_ID 형식이 잘못되었습니다')
    return (cached = fromEnv)
  }
  const data = await authAdmin('users?page=1&per_page=2')
  const users = data?.users ?? []
  if (users.length !== 1) throw new Error(`사용자가 ${users.length}명이라 주인을 정할 수 없습니다. AGENT_USER_ID를 설정해 주세요`)
  return (cached = users[0].id)
}

// 테스트에서 캐시를 비울 때
export const resetOwnerCache = () => {
  cached = null
}
