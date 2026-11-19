import { supabase } from './supabaseClient.js'

// 개발 창 데이터 관리 탭의 정리 요청 (보고서 12 3단계). 서버 입구 /api/dev-admin이 로그인한 주인인지 확인하고 쓴다.
// 실패하면 Error(message = 서버가 준 오류 이름, 예: 'no-work')를 던진다.
export async function runDevAdmin(body) {
  const { data } = (await supabase?.auth.getSession()) ?? {}
  const token = data?.session?.access_token
  if (!token) throw new Error('login-required')
  const response = await fetch('/api/dev-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || `http-${response.status}`)
  return result
}
