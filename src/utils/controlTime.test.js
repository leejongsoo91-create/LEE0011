// 중앙관제 날짜 계산: 한국 시간 기준

import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, formatAt, kstDate, kstTime } from './controlTime.js'

test('한국 날짜·시각: UTC 15시는 한국 다음 날 0시', () => {
  const date = new Date('2026-11-05T15:30:00Z')
  assert.equal(kstDate(date), '2026-11-06')
  assert.equal(kstTime(date), '00:30')
})

test('날짜 더하기: 달·해 넘김', () => {
  assert.equal(addDays('2026-11-28', 7), '2026-12-05')
  assert.equal(addDays('2026-12-30', 3), '2027-01-02')
})

test('표시: 오늘이면 시각만, 아니면 월-일 시각', () => {
  const now = new Date('2026-11-06T03:00:00Z') // 한국 12:00
  assert.equal(formatAt('2026-11-06T01:05:00Z', now), '10:05')
  assert.equal(formatAt('2026-11-05T01:05:00Z', now), '11-05 10:05')
  assert.equal(formatAt(null, now), '')
})
