// 보고서 10 보안 보완: 일정 알림은 주인만, 알림 예약 입구의 시크릿 길이, 배포 보안 헤더

import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import notifyHandler from '../notify-schedule.js'
import remindHandler from '../send-reminders.js'
import { resetOwnerCache } from './owner.js'
import { callWebhook, installFakes, OWNER_UID } from './testkit.js'

const OTHER_UID = '22222222-2222-4222-8222-222222222222'
const TOKENS = { 'Bearer owner-token': OWNER_UID, 'Bearer other-token': OTHER_UID }

let fake
beforeEach(() => {
  fake = installFakes()
  resetOwnerCache()
  process.env.SUPABASE_ANON_KEY = 'anon-key'
  // 가짜 Supabase Auth: 로그인 토큰 → 사용자
  const base = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    if (new URL(url).pathname === '/auth/v1/user') {
      const id = TOKENS[options.headers?.Authorization]
      return id ? new Response(JSON.stringify({ id })) : new Response('{}', { status: 401 })
    }
    return base(url, options)
  }
})

const notify = (authorization) =>
  callWebhook(notifyHandler, {
    body: { title: '회의', date: '2026-11-20', time: '15:00' },
    headers: authorization ? { authorization } : {},
  })

test('일정 알림: 로그인 없음 401, 주인이 아닌 계정 403 (텔레그램 안 보냄), 주인은 보냄', async () => {
  assert.equal((await notify()).status, 401)
  assert.equal((await notify('Bearer wrong')).status, 401)
  assert.equal((await notify('Bearer other-token')).status, 403)
  assert.equal(fake.sent.length, 0)

  const ok = await notify('Bearer owner-token')
  assert.equal(ok.status, 200)
  assert.equal(fake.sent.length, 1)
  assert.match(fake.sent[0].text, /새로운 일정 등록/)
})

test('알림 예약 입구: CRON_SECRET이 32자보다 짧거나 앞뒤 공백이면 503, 헤더가 틀리면 401', async () => {
  const call = (secret) => callWebhook(remindHandler, { headers: { 'x-cron-secret': secret } })
  process.env.CRON_SECRET = 'short-secret'
  assert.equal((await call('short-secret')).status, 503)
  process.env.CRON_SECRET = ' cron-secret-0123456789-abcdefghijklmn '
  assert.equal((await call(process.env.CRON_SECRET)).status, 503)

  process.env.CRON_SECRET = 'cron-secret-0123456789-abcdefghijklmn'
  assert.equal((await call('cron-secret-0123456789-abcdefghijklmX')).status, 401)
  assert.equal((await callWebhook(remindHandler, { headers: {} })).status, 401)
  assert.equal((await callWebhook(remindHandler, { headers: { 'x-cron-secret': ['a', 'b'] } })).status, 401)
})

test('배포 보안 헤더: 모든 주소에 CSP·클릭재킹·MIME·리퍼러·권한 헤더', () => {
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  const all = config.headers.find((rule) => rule.source === '/(.*)')
  assert.ok(all, '모든 주소용 헤더 규칙이 있어야 한다')
  const headers = Object.fromEntries(all.headers.map((h) => [h.key, h.value]))
  assert.equal(headers['X-Frame-Options'], 'DENY')
  assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.match(headers['Permissions-Policy'], /camera=\(\)/)

  const csp = headers['Content-Security-Policy']
  assert.match(csp, /script-src 'self'(;|$)/, '스크립트는 내 사이트 것만 (인라인 금지)')
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /object-src 'none'/)
  assert.match(csp, /connect-src 'self' https:\/\/\*\.supabase\.co/)
})

test('index.html에 인라인 스크립트가 없다 (CSP가 막으므로)', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  for (const tag of html.match(/<script[^>]*>/g) ?? []) assert.match(tag, /\ssrc=/, `src 없는 스크립트: ${tag}`)
})
