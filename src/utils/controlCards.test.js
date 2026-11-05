// 중앙관제 카드 숫자: 업무 상태, 일정(한국 시간), 에이전트 요약 연결

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildControlCards } from './controlCards.js'

const now = new Date('2026-11-06T03:00:00Z') // 한국 11/6 12:00
const rows = (list) => ({ rows: list, isLoading: false })

const sources = (agent = null) => ({
  summary: { data: agent, isLoading: false },
  work: rows([
    { id: 1, title: '보고서', status: 'In Progress' },
    { id: 2, title: '정리', status: 'Todo' },
    { id: 3, title: '끝', status: 'Done' },
  ]),
  schedule: rows([
    { id: 1, title: '아침 회의', date: '2026-11-06', time: '09:00' },
    { id: 2, title: '저녁 약속', date: '2026-11-06', time: '19:00' },
    { id: 3, title: '병원', date: '2026-11-10', time: null },
    { id: 4, title: '먼 일정', date: '2026-11-20' },
    { id: 5, title: '지난 일정', date: '2026-11-05' },
  ]),
  investments: rows([{ id: 1, ticker: 'AAPL', name: '애플' }, { id: 2, ticker: '005930', name: null }]),
})

test('업무·일정·투자 카드 숫자', () => {
  const [, work, schedule, invest] = buildControlCards(sources(), now)
  assert.deepEqual([work.main.value, work.sub, work.items], [1, '할 일 1 · 완료 1', '보고서'])
  assert.deepEqual([schedule.main.value, schedule.sub, schedule.items], [2, '7일 안 1 · 오늘 지난 1', '다음: 19:00 저녁 약속'])
  assert.deepEqual([invest.main.value, invest.items], [2, '애플 · 005930'])
})

test('에이전트 요약이 없으면 —, 있으면 숫자와 확인 필요', () => {
  const [agentCard, , scheduleCard] = buildControlCards(sources(), now)
  assert.equal(agentCard.main.value, '—')
  assert.equal(agentCard.attention, undefined)
  assert.equal(scheduleCard.attention, undefined)

  const summary = {
    agent: { running: 1, waiting: 2, doneToday: 3, attention: 1 },
    schedule: { waiting: 1, attention: 1 },
    invest: { lookupsToday: 4, failedToday: 0 },
  }
  const [agent, , schedule, invest] = buildControlCards(sources(summary), now)
  assert.deepEqual([agent.main.value, agent.sub, agent.attention], [1, '결재 대기 2 · 오늘 완료 3', 1])
  assert.equal(schedule.attention, 2)
  assert.deepEqual([invest.sub, invest.attention], ['오늘 조회 4', 0])
})
