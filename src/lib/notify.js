import { supabase } from './supabaseClient.js'

// 새 일정이 등록되었음을 텔레그램으로 알린다. (서버 함수 /api/notify-schedule 이 대신 전송)
// 알림은 부가 기능이므로 어떤 이유로 실패해도 오류를 던지지 않고 조용히 넘어간다.
export async function notifyScheduleAdded({ title, date, time }) {
  try {
    const { data } = (await supabase?.auth.getSession()) ?? {}
    const accessToken = data?.session?.access_token
    if (!accessToken) return
    await fetch('/api/notify-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ title, date, time: time || null }),
    })
  } catch {
    // 알림 실패는 일정 저장 결과에 영향을 주지 않는다.
  }
}
