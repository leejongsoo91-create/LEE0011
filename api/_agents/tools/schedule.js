// 일정 부서 도구: schedule.list(read), schedule.create(write, 원복 = 등록한 행 삭제)
// 규칙서: rules/dept_schedule.md. 모든 쿼리에 주인 user_id 조건을 코드가 강제로 붙인다.

import { ownerUserId } from '../owner.js'
import { rest } from '../supabase.js'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
export const REMIND_OPTIONS = [0, 10, 30, 60]
const DAY = 24 * 60 * 60 * 1000
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const validDate = (value) =>
  typeof value === 'string' && DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

function onlyKeys(args, allowed) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return '인자가 객체가 아닙니다'
  const unknown = Object.keys(args).filter((key) => !allowed.includes(key))
  return unknown.length ? `모르는 인자: ${unknown.join(', ')}` : null
}

export const dayLabel = (date) => {
  const d = new Date(`${date}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`
}
const remindLabel = (min) => (min == null ? '알림 없음' : min === 0 ? '정시 알림' : min === 60 ? '1시간 전 알림' : `${min}분 전 알림`)

export const scheduleCreate = {
  dept: 'schedule',
  label: '일정 등록',
  risk: 'write',
  description: '일정 1건을 등록한다.',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '일정 제목 1~100자' },
      date: { type: 'string', description: 'YYYY-MM-DD (한국 날짜)' },
      time: { type: ['string', 'null'], description: 'HH:MM 24시간제, 종일 일정이면 null' },
      remind_before_min: { type: ['integer', 'null'], enum: [...REMIND_OPTIONS, null], description: '몇 분 전 알림. 시간이 있을 때만' },
    },
    required: ['title', 'date'],
  },
  check(args) {
    const keys = onlyKeys(args, ['title', 'date', 'time', 'remind_before_min'])
    if (keys) return keys
    if (typeof args.title !== 'string' || !args.title.trim() || args.title.length > 100) return 'title은 1~100자여야 합니다'
    if (!validDate(args.date)) return 'date는 실제 있는 날짜(YYYY-MM-DD)여야 합니다'
    const time = args.time ?? null
    if (time !== null && (typeof time !== 'string' || !TIME.test(time))) return 'time은 HH:MM(24시간제) 또는 null이어야 합니다'
    const remind = args.remind_before_min ?? null
    if (remind !== null && !REMIND_OPTIONS.includes(remind)) return 'remind_before_min은 0, 10, 30, 60, null 중 하나여야 합니다'
    if (remind !== null && time === null) return '시간이 없는 종일 일정에는 알림을 걸 수 없습니다'
    return null
  },
  describe: (args) =>
    `${dayLabel(args.date)} ${args.time ?? '종일'} · "${args.title}" · ${remindLabel(args.time ? (args.remind_before_min ?? null) : null)}`,
  async run(args) {
    const userId = await ownerUserId()
    const time = args.time ?? null
    const rows = await rest('schedule', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        user_id: userId,
        title: args.title.trim(),
        date: args.date,
        time,
        remind_before_min: time ? (args.remind_before_min ?? null) : null,
      },
    })
    const row = rows?.[0]
    if (!row?.id) throw new Error('일정 등록 결과를 받지 못했습니다')
    return { recordId: row.id, summary: `일정 등록: ${scheduleCreate.describe(args)}` }
  },
  // 원복: 방금 등록한 그 행만, 주인 user_id 조건을 붙여 삭제한다.
  async undo(args, output) {
    const userId = await ownerUserId()
    if (!output?.recordId) throw new Error('지울 일정 id가 없습니다')
    const rows = await rest(`schedule?id=eq.${output.recordId}&user_id=eq.${userId}`, {
      method: 'DELETE',
      prefer: 'return=representation',
    })
    return { summary: rows?.length ? `일정 삭제: "${args.title}"` : '이미 지워진 일정' }
  },
}

export const scheduleList = {
  dept: 'schedule',
  label: '일정 조회',
  risk: 'read',
  description: '기간 안의 내 일정을 날짜·시간 순으로 최대 50건 조회한다.',
  schema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: '시작 날짜 YYYY-MM-DD' },
      to: { type: 'string', description: '끝 날짜 YYYY-MM-DD (from 이후, 최대 62일)' },
    },
    required: ['from', 'to'],
  },
  check(args) {
    const keys = onlyKeys(args, ['from', 'to'])
    if (keys) return keys
    if (!validDate(args.from) || !validDate(args.to)) return 'from·to는 실제 있는 날짜(YYYY-MM-DD)여야 합니다'
    const span = (Date.parse(args.to) - Date.parse(args.from)) / DAY
    if (span < 0) return 'to가 from보다 앞설 수 없습니다'
    if (span > 62) return '조회 기간은 최대 62일입니다'
    return null
  },
  describe: (args) => (args.from === args.to ? dayLabel(args.from) : `${dayLabel(args.from)} ~ ${dayLabel(args.to)}`),
  async run(args) {
    const userId = await ownerUserId()
    const rows =
      (await rest(
        `schedule?select=title,date,time&user_id=eq.${userId}&date=gte.${args.from}&date=lte.${args.to}` +
          '&order=date.asc,time.asc.nullsfirst&limit=50',
      )) ?? []
    const lines = rows.slice(0, 15).map((row) => `  · ${dayLabel(row.date)} ${row.time?.slice(0, 5) ?? '종일'} ${row.title}`)
    const more = rows.length > 15 ? [`  …외 ${rows.length - 15}건`] : []
    return {
      count: rows.length,
      summary: [`${scheduleList.describe(args)} 일정 ${rows.length}건`, ...lines, ...more].join('\n'),
    }
  },
}
