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

test('가짜 계획 작성기: 낱말로 시나리오를 고르고, 반려 사유의 낱말이 우선한다', () => {
  const kinds = (plan) => plan.steps.map((s) => `${s.tool}:${s.risk}`)
  assert.deepEqual(kinds(buildTestPlan('내일 3시 회의')), ['test.write:write'])
  assert.deepEqual(kinds(buildTestPlan('일정 조회')), ['test.lookup:read'])
  assert.deepEqual(kinds(buildTestPlan('실패 테스트')), ['test.write:write', 'test.fail_write:write'])
  const undoFail = buildTestPlan('원복 실패 테스트')
  assert.equal(undoFail.scenario, 'undo-fail')
  assert.equal(undoFail.steps[0].args.failUndo, true)
  assert.equal(buildTestPlan('실패 테스트', { feedback: '조회로 바꿔' }).scenario, 'lookup')
  assert.equal(buildTestPlan('조회', { feedback: '다시' }).scenario, 'lookup')
  assert.equal(buildTestPlan('조회', { feedback: '다시' }).feedback, '다시')
  assert.match(describePlan(buildTestPlan('실패')), /1\. 테스트 쓰기 \[쓰기·원복 가능\]\n2\. 실패하는 테스트 쓰기/)
})
