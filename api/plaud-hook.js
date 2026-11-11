// Vercel 함수: Plaud 회의 녹음 입구. Zapier("Transcript & Summary Ready" → Code by Zapier)가 호출한다.
// 하는 일은 딱 하나: 받은 녹음을 받은함(plaud_inbox)에 넣고 바로 응답한다.
//   결재 요청은 /api/agent-cron이 1분 안에 받은함을 꺼내 보낸다 (plaudTrigger.js).
//   무료 Zapier의 Code 단계는 1초 안에 끝나야 해서, 여기서는 DB 한 번만 부르고 AI·텔레그램은 부르지 않는다.
//
// 보안: 인터넷에 열린 주소라서 PLAUD_HOOK_SECRET을 가진 호출만 받는다. (/api/agent-cron과 같은 방식)
//   1) PLAUD_HOOK_SECRET이 없거나 32자보다 짧거나 앞뒤에 공백이 있으면 → 503
//   2) POST만 → 그 밖은 405
//   3) x-plaud-secret 헤더 하나만 본다. 두 값을 SHA-256으로 바꾼 뒤 timingSafeEqual로 비교
//   4) 실패하면 401 {error:'unauthorized'}만. 받은 값은 응답·로그에 남기지 않는다
//
// 받는 본문(JSON): { title, summary, created_at }   ← Zapier의 Title · Summary · Create Time
//   녹취록(transcript)은 보내지 않게 Code 단계에서 빼고, 보내더라도 여기서 버린다.
// 같은 녹음이 다시 와도(Zapier 재전송·재요약) 받은함 source_key가 같아 한 번만 들어간다.

import { createHash, timingSafeEqual } from 'node:crypto'
import { cleanSummary, cleanTitle, plaudKey, plaudTimeToIso } from './_agents/plaud.js'
import { rest } from './_agents/supabase.js'

export const MIN_SECRET_LENGTH = 32

const digest = (value) => createHash('sha256').update(value, 'utf8').digest()

export function checkHookRequest(req, secret = process.env.PLAUD_HOOK_SECRET) {
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH || secret !== secret.trim()) {
    return { ok: false, status: 503, body: { error: 'not-configured' } }
  }
  if (req.method !== 'POST') return { ok: false, status: 405, body: { error: 'method-not-allowed' } }
  const given = req.headers?.['x-plaud-secret']
  if (typeof given !== 'string' || given.length === 0 || !timingSafeEqual(digest(given), digest(secret))) {
    return { ok: false, status: 401, body: { error: 'unauthorized' } }
  }
  return { ok: true }
}

// 본문 → 받은함 한 줄. 요약이 문자열이 아니면 null (잘못된 요청)
export function inboxRow(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  if (typeof body.summary !== 'string') return null
  const title = cleanTitle(body.title)
  return {
    source_key: plaudKey(body.created_at, body.title),
    title,
    summary_md: cleanSummary(body.summary),
    recorded_at: plaudTimeToIso(body.created_at),
  }
}

export default async function handler(req, res) {
  const gate = checkHookRequest(req)
  if (!gate.ok) {
    if (gate.status === 405) res.setHeader('Allow', 'POST')
    if (gate.status === 503) console.error('[plaud-hook] PLAUD_HOOK_SECRET이 없거나 32자보다 짧거나 앞뒤에 공백이 있어요')
    return res.status(gate.status).json(gate.body)
  }

  const row = inboxRow(req.body)
  if (!row) return res.status(400).json({ error: 'bad-request' })

  try {
    const saved = await rest('plaud_inbox?on_conflict=source_key', {
      method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=representation',
      body: row,
    })
    return res.status(200).json({ status: saved?.length ? 'queued' : 'duplicate' })
  } catch (error) {
    // Zapier에 실패로 보이게 500을 돌려준다 (Zap 기록에서 확인할 수 있게)
    console.error('[plaud-hook] 받은함 저장 실패', error?.message)
    return res.status(500).json({ error: 'store-failed' })
  }
}
