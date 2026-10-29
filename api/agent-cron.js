// Vercel 함수: 일정 자동 작업 크론 입구. Supabase pg_cron이 1분마다 호출한다.
//   (supabase/migrations/20261030000000_schedule_agent_tasks.sql)
// 하는 일: ① 남은 작업 정리(만료·멈춤) ② 때가 된 일정의 에이전트 작업을 계획해 텔레그램으로 결재 요청
//
// 보안: 인터넷에 열린 주소라서, CRON_SECRET을 가진 호출만 DB·AI·텔레그램에 닿게 한다.
//   1) CRON_SECRET이 없거나 32자보다 짧거나 앞뒤에 공백이 있으면 → 503 (설정이 약하면 열지 않는다)
//   2) POST만 → 그 밖은 405
//   3) x-cron-secret 헤더 하나만 본다. 주소(?secret=)·본문의 값은 보지 않는다. 문자열이 아니면(헤더 중복 등) 거부
//   4) 두 값을 SHA-256으로 바꾼 뒤 timingSafeEqual로 비교 (길이가 달라도 걸리는 시간이 같다)
//   5) 실패하면 401 {error:'unauthorized'}만. 무엇이 틀렸는지, 받은 값은 응답·로그 어디에도 남기지 않는다
//   6) 문지기를 통과한 뒤에야 AGENT_MODE 확인, DB 조회, AI 호출을 한다
// 필요한 환경변수(Vercel에만): CRON_SECRET, AGENT_MODE=on, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

import { createHash, timingSafeEqual } from 'node:crypto'
import { sweepStale } from './_agents/orchestrator.js'
import { runScheduleTriggers } from './_agents/scheduleTrigger.js'

export const MIN_SECRET_LENGTH = 32

const digest = (value) => createHash('sha256').update(value, 'utf8').digest()

// 요청이 pg_cron(같은 CRON_SECRET을 가진 쪽)에서 왔는지. { ok } 또는 { ok:false, status, body }
export function checkCronRequest(req, secret = process.env.CRON_SECRET) {
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH || secret !== secret.trim()) {
    return { ok: false, status: 503, body: { error: 'not-configured' } }
  }
  if (req.method !== 'POST') return { ok: false, status: 405, body: { error: 'method-not-allowed' } }
  const given = req.headers?.['x-cron-secret']
  if (typeof given !== 'string' || given.length === 0 || !timingSafeEqual(digest(given), digest(secret))) {
    return { ok: false, status: 401, body: { error: 'unauthorized' } }
  }
  return { ok: true }
}

export default async function handler(req, res) {
  const gate = checkCronRequest(req)
  if (!gate.ok) {
    if (gate.status === 405) res.setHeader('Allow', 'POST')
    if (gate.status === 503) console.error('[agent-cron] CRON_SECRET이 없거나 32자보다 짧거나 앞뒤에 공백이 있어요')
    return res.status(gate.status).json(gate.body)
  }

  if (process.env.AGENT_MODE !== 'on') return res.status(200).json({ status: 'off' })
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) return res.status(200).json({ status: 'not-configured' })

  let swept = []
  try {
    swept = await sweepStale(chatId)
  } catch (error) {
    console.error('[agent-cron] 남은 작업 정리 실패', error)
  }

  try {
    const result = await runScheduleTriggers({ chatId })
    return res.status(200).json({ status: 'ok', swept: swept.length, ...result })
  } catch (error) {
    // 텔레그램으로는 보내지 않는다: 1분마다 같은 오류 알림이 쌓이지 않게. 작업이 중간에 멈췄다면 5분 뒤 STALLED 알림이 간다.
    console.error('[agent-cron] 자동 작업 처리 실패', error)
    return res.status(200).json({ status: 'error', swept: swept.length })
  }
}
