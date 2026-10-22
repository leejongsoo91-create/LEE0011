// Vercel 서버 함수: 알릴 시간이 된 일정을 찾아 텔레그램으로 알린다.
// Supabase의 pg_cron이 1분마다 호출한다. (supabase/migrations/20261023010000_schedule_reminder_cron.sql)
// 필요한 환경변수(모두 Vercel에만 등록, VITE_ 접두사 금지):
//   CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
import { timingSafeEqual } from 'node:crypto'
import { scheduleLines, sendTelegram } from './_lib/telegram.js'

const MINUTE = 60 * 1000
// 일정 시각이 이 시간보다 더 지났으면 이미 늦은 알림이라 보내지 않고 처리만 해 둔다.
const STALE_AFTER = 60 * MINUTE
// 일정의 날짜와 시간은 한국 시간으로 저장된다고 본다.
const KST_OFFSET = 9 * 60 * MINUTE

export function startOf(row) {
  return Date.parse(`${row.date}T${row.time.slice(0, 5)}:00+09:00`)
}

// 알림을 보낼 시각이 되었는지(due), 너무 늦어서 건너뛸지(stale)
export function judge(row, now) {
  const start = startOf(row)
  return { due: now >= start - row.remind_before_min * MINUTE, stale: now > start + STALE_AFTER }
}

export function buildReminder(row) {
  const lines = scheduleLines(row)
  if (!lines) return null
  const lead = row.remind_before_min
  const when = lead === 0 ? '지금 시작합니다' : lead % 60 === 0 ? `${lead / 60}시간 후 시작합니다` : `${lead}분 후 시작합니다`
  return ['⏰ [일정 알림]', ...lines, `알림: ${when}`].join('\n')
}

function safeEqual(a = '', b = '') {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function restHeaders(serviceKey, extra = {}) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...extra }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 사용할 수 있습니다' })

  const secret = process.env.CRON_SECRET
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !url || !serviceKey) return res.status(503).json({ error: '서버 설정이 없습니다' })
  if (!safeEqual(req.headers['x-cron-secret'], secret)) return res.status(401).json({ error: '권한이 없습니다' })

  try {
    const now = Date.now()
    const day = (offset) => new Date(now + KST_OFFSET + offset * 24 * 60 * MINUTE).toISOString().slice(0, 10)
    const query =
      `select=id,title,date,time,remind_before_min&reminded_at=is.null&remind_before_min=not.is.null&time=not.is.null` +
      `&date=gte.${day(-1)}&date=lte.${day(1)}`
    const listed = await fetch(`${url}/rest/v1/schedule?${query}`, { headers: restHeaders(serviceKey) })
    if (!listed.ok) return res.status(502).json({ error: '일정을 불러오지 못했습니다' })
    const rows = await listed.json()

    let sent = 0
    let skipped = 0
    for (const row of rows) {
      const { due, stale } = judge(row, now)
      if (!due) continue

      // 먼저 '보냄'으로 표시해서(선점) 호출이 겹쳐도 같은 알림이 두 번 가지 않게 한다.
      const claim = await fetch(`${url}/rest/v1/schedule?id=eq.${row.id}&reminded_at=is.null`, {
        method: 'PATCH',
        headers: restHeaders(serviceKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({ reminded_at: new Date(now).toISOString() }),
      })
      if (!claim.ok || (await claim.json()).length === 0) continue

      if (stale) {
        skipped += 1
        continue
      }
      const message = buildReminder(row)
      const result = message ? await sendTelegram(message) : { ok: false }
      if (result.ok) {
        sent += 1
      } else {
        // 전송에 실패하면 표시를 되돌려 다음 분에 다시 시도한다.
        await fetch(`${url}/rest/v1/schedule?id=eq.${row.id}`, {
          method: 'PATCH',
          headers: restHeaders(serviceKey),
          body: JSON.stringify({ reminded_at: null }),
        })
      }
    }
    return res.status(200).json({ checked: rows.length, sent, skipped })
  } catch {
    return res.status(500).json({ error: '알림 확인 중 오류가 났습니다' })
  }
}
