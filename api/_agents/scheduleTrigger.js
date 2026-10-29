// 일정 자동 작업: 일정에 적어 둔 "에이전트 작업"을 일정 시각이 다가오면 계획해 결재를 요청한다.
// /api/agent-cron(pg_cron이 1분마다 호출)이 부른다. 계획부터는 텔레그램 지시와 같은 planAndRoute를 쓴다.
//
//   때가 됨   : 일정 시각 − agent_before_min ≤ 지금
//   놓침     : 일정 시각 + 30분 < 지금 → 계획하지 않고 FAILED(MISSED) + 알림 한 번
//   중복 방지 : agent_tasks.source_key = schedule:<일정 id>:<날짜>T<시각> (unique)
//   한 번에   : 계획은 가장 이른 일정 1개만 (나머지는 다음 분에). 함수 시간 60초 안에 끝내기 위해서다.
//   결재     : 읽기 전용 계획이라도 항상 결재 (orchestrator가 source_key를 보고 판단, G-9)

import { dayLabel } from './depts/schedule/tools.js'
import { planAndRoute } from './orchestrator.js'
import { ownerUserId } from './owner.js'
import { missedText } from './report.js'
import { rest } from './supabase.js'
import { sendMessage } from './telegram.js'
import { createTask, existingSourceKeys } from './tasks.js'

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE
const KST_OFFSET = 9 * 60 * MINUTE
export const AGENT_BEFORE_OPTIONS = [0, 10, 30, 60]
export const DEFAULT_AGENT_BEFORE_MIN = 10
export const MISSED_AFTER_MS = 30 * MINUTE
export const MAX_PLANS_PER_RUN = 1
const TIME = /^([01]\d|2[0-3]):[0-5]\d/

const hhmm = (row) => row.time.slice(0, 5)
export const startOf = (row) => Date.parse(`${row.date}T${hhmm(row)}:00+09:00`)
const beforeMin = (row) => (AGENT_BEFORE_OPTIONS.includes(row.agent_before_min) ? row.agent_before_min : DEFAULT_AGENT_BEFORE_MIN)
export const dueAt = (row) => startOf(row) - beforeMin(row) * MINUTE
export const triggerKey = (row) => `schedule:${row.id}:${row.date}T${hhmm(row)}`
const when = (row) => `${dayLabel(row.date)} ${hhmm(row)}`

// AI에게 줄 지시: 캡틴이 적어 둔 문장 + 어느 일정의 자동 작업인지
export const instructionText = (row) => `${row.agent_task.trim()} (일정 '${row.title || '제목 없음'}' ${when(row)}에 맞춘 자동 작업)`

const kstDay = (ms) => new Date(ms + KST_OFFSET).toISOString().slice(0, 10)

// 자동 작업 대상 일정 중 때가 된 것 (이미 작업을 만든 일정은 뺀다). 일정 시각이 이른 순.
export async function findDueSchedules(now = Date.now()) {
  const userId = await ownerUserId()
  const rows =
    (await rest(
      `schedule?select=id,title,date,time,agent_task,agent_before_min&user_id=eq.${userId}` +
        `&agent_task=not.is.null&time=not.is.null&date=gte.${kstDay(now - DAY)}&date=lte.${kstDay(now + DAY)}`,
    )) ?? []
  const candidates = rows
    .filter((row) => row.agent_task?.trim() && TIME.test(row.time ?? '') && dueAt(row) <= now)
    .sort((a, b) => startOf(a) - startOf(b))
  const done = await existingSourceKeys(candidates.map(triggerKey))
  return candidates.filter((row) => !done.has(triggerKey(row)))
}

const originOf = (row) => ({ kind: 'schedule', schedule_id: row.id, title: row.title || '제목 없음', when: when(row) })

// 크론 한 번에 할 일. 돌려주는 값: { due, missed, started: [결과…] }
export async function runScheduleTriggers({ chatId, now = Date.now(), limit = MAX_PLANS_PER_RUN, options } = {}) {
  const due = await findDueSchedules(now)
  const result = { due: due.length, missed: 0, started: [] }

  for (const row of due) {
    const base = { query: instructionText(row), sourceKey: triggerKey(row) }

    // 너무 늦게 발견: 계획하지 않고 기록만 남기고 한 번 알린다 (키가 남아 다시 알리지 않음)
    if (now > startOf(row) + MISSED_AFTER_MS) {
      const task = await createTask({
        ...base,
        status: 'FAILED',
        log: { agent: 'intake', event: 'MISSED', origin: originOf(row), note: '일정 시각이 30분 넘게 지나서 발견' },
      })
      if (task) {
        result.missed += 1
        await sendMessage(chatId, missedText(task))
      }
      continue
    }

    if (result.started.length >= limit) continue
    const task = await createTask({ ...base, status: 'PLANNING', log: { agent: 'intake', event: 'CREATED', origin: originOf(row) } })
    if (!task) continue // 다른 크론 호출이 먼저 만들었다
    result.started.push(await planAndRoute(task, chatId, options))
  }
  return result
}
