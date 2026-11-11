// Vercel 함수: 개발 팀(Lead Coder · QA/Reviewer · DevOps/Monitor) 작업 기록 입구.
// 노트북의 scripts/dev-log.mjs가 단계마다 한 줄씩 보낸다. 받은 기록은 dev_log에 넣고, 업무 탭이 읽는다.
//
// 보안: 인터넷에 열린 주소라서 DEV_LOG_SECRET을 가진 호출만 받는다. (/api/plaud-hook과 같은 방식)
//   1) DEV_LOG_SECRET이 없거나 32자보다 짧거나 앞뒤에 공백이 있으면 → 503
//   2) POST만 → 그 밖은 405
//   3) x-dev-log-secret 헤더 하나만 본다. 두 값을 SHA-256으로 바꾼 뒤 timingSafeEqual로 비교
//   4) 실패하면 401 {error:'unauthorized'}만. 받은 값은 응답·로그에 남기지 않는다
//
// 받는 본문(JSON): { agent, kind, status, summary, ref? }
//   요약이 비밀 값처럼 보이면(긴 토큰, sk-·eyJ·sb_secret_ 등) 저장하지 않고 400.
// 알림: QA 실패, 배포 실패일 때만 텔레그램으로 한 줄 보낸다. 알림이 실패해도 기록은 남는다.

import { createHash, timingSafeEqual } from 'node:crypto'
import { ownerUserId } from './_agents/owner.js'
import { rest } from './_agents/supabase.js'
import { sendMessage } from './_agents/telegram.js'

export const MIN_SECRET_LENGTH = 32
export const AGENTS = { lead: 'Lead Coder', qa: 'QA/Reviewer', devops: 'DevOps/Monitor' }
export const KINDS = ['plan', 'edit', 'test', 'review', 'commit', 'deploy', 'check']
export const STATUSES = ['running', 'pass', 'fail', 'info']
export const MAX_SUMMARY = 300

const digest = (value) => createHash('sha256').update(value, 'utf8').digest()

export function checkDevLogRequest(req, secret = process.env.DEV_LOG_SECRET) {
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH || secret !== secret.trim()) {
    return { ok: false, status: 503, body: { error: 'not-configured' } }
  }
  if (req.method !== 'POST') return { ok: false, status: 405, body: { error: 'method-not-allowed' } }
  const given = req.headers?.['x-dev-log-secret']
  if (typeof given !== 'string' || given.length === 0 || !timingSafeEqual(digest(given), digest(secret))) {
    return { ok: false, status: 401, body: { error: 'unauthorized' } }
  }
  return { ok: true }
}

// 비밀 값처럼 보이는 글자: 알려진 키·토큰 머리글(Anthropic·Supabase·JWT·GitHub·Slack·AWS·텔레그램 봇 토큰),
// 또는 / · - 없이 41자 넘게 이어진 영문·숫자 (커밋 해시 40자, 파일 경로, 주소는 통과)
const SECRET_LIKE =
  /(sk-[A-Za-z0-9_-]{8,}|sb_secret_|eyJ[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_|xox[bp]-|AKIA[A-Z0-9]{12,}|\d{8,10}:[A-Za-z0-9_-]{30,}|[A-Za-z0-9_+=]{41,})/

// ref: 커밋 해시(7~40자) 또는 https 주소만
const REF = /^([0-9a-f]{7,40}|https:\/\/\S{1,290})$/

// 본문 → 저장할 한 줄. 잘못되었으면 { error }
export function devLogRow(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'bad-request' }
  const { agent, kind, status } = body
  if (!Object.hasOwn(AGENTS, agent) || !KINDS.includes(kind) || !STATUSES.includes(status)) return { error: 'bad-request' }
  if (typeof body.summary !== 'string') return { error: 'bad-request' }
  const summary = body.summary.replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY)
  if (!summary) return { error: 'bad-request' }
  if (SECRET_LIKE.test(summary)) return { error: 'looks-secret' }
  let ref = null
  if (body.ref != null && body.ref !== '') {
    if (typeof body.ref !== 'string' || !REF.test(body.ref.trim())) return { error: 'bad-ref' }
    if (SECRET_LIKE.test(body.ref)) return { error: 'looks-secret' }
    ref = body.ref.trim()
  }
  return { row: { agent, kind, status, summary, ref } }
}

// QA 실패나 배포 실패면 텔레그램 알림 문구, 아니면 null
export function alertText(row) {
  if (row.status !== 'fail') return null
  if (row.agent === 'qa') return `⚠️ [개발 팀] QA 검토·테스트 실패\n${row.summary}`
  if (row.kind === 'deploy') return `⚠️ [개발 팀] 배포 실패\n${row.summary}`
  return null
}

export default async function handler(req, res) {
  const gate = checkDevLogRequest(req)
  if (!gate.ok) {
    if (gate.status === 405) res.setHeader('Allow', 'POST')
    if (gate.status === 503) console.error('[dev-log] DEV_LOG_SECRET이 없거나 32자보다 짧거나 앞뒤에 공백이 있어요')
    return res.status(gate.status).json(gate.body)
  }

  const parsed = devLogRow(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  try {
    const user_id = await ownerUserId()
    await rest('dev_log', { method: 'POST', prefer: 'return=minimal', body: { ...parsed.row, user_id } })
  } catch (error) {
    console.error('[dev-log] 기록 저장 실패', error?.message)
    return res.status(500).json({ error: 'store-failed' })
  }

  let alerted = false
  const text = alertText(parsed.row)
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (text && chatId && process.env.TELEGRAM_BOT_TOKEN) {
    // sendMessage는 실패해도 예외 없이 { ok:false }를 돌려준다
    alerted = (await sendMessage(chatId, text)).ok
  }
  return res.status(200).json({ status: 'saved', alerted })
}
