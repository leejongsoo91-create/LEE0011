import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTestPlan, describePlan, hashPlan } from './plan.js'

test('해시는 키 순서가 달라도 같고, 내용이 바뀌면 달라진다', () => {
  const a = { version: 1, steps: [{ tool: 't', args: { x: 1, y: 2 }, risk: 'write' }] }
  const b = { steps: [{ risk: 'write', args: { y: 2, x: 1 }, tool: 't' }], version: 1 }
  assert.equal(hashPlan(a), hashPlan(b))
  assert.notEqual(hashPlan(a), hashPlan({ ...a, version: 2 }))
  assert.match(hashPlan(a), /^[0-9a-f]{64}$/)
})

test('테스트 계획은 write 단계 하나이고 요약 문장이 만들어진다', () => {
  const plan = buildTestPlan('내일 3시 회의')
  assert.equal(plan.steps.length, 1)
  assert.equal(plan.steps[0].risk, 'write')
  assert.match(describePlan(plan), /1\. test\.noop \(write\)/)
})
