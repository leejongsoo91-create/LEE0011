import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePlan } from './validator.js'
import { buildTestPlan } from './plan.js'

const write = (text = 'x') => ({ tool: 'test.write', args: { text }, risk: 'write' })
const read = (text = 'x') => ({ tool: 'test.lookup', args: { text }, risk: 'read' })

test('정상 계획: 읽기만이면 결재 불필요, 쓰기가 있으면 결재 필요', () => {
  assert.deepEqual(validatePlan(buildTestPlan('조회')), { ok: true, needsApproval: false })
  assert.deepEqual(validatePlan(buildTestPlan('회의')), { ok: true, needsApproval: true })
  assert.deepEqual(validatePlan({ steps: [read(), write()] }), { ok: true, needsApproval: true })
})

test('5. 등록되지 않은 도구 → 거부', () => {
  const verdict = validatePlan({ steps: [{ tool: 'evil.delete_all', args: {}, risk: 'read' }] })
  assert.equal(verdict.ok, false)
  assert.match(verdict.errors[0], /등록되지 않은 도구/)
  assert.equal(validatePlan({ steps: [{ tool: 'constructor', args: {}, risk: 'read' }] }).ok, false)
})

test('6. 6단계 이상 / 되돌릴 수 없는 단계가 마지막이 아님 → 거부', () => {
  const six = validatePlan({ steps: Array.from({ length: 6 }, () => write()) })
  assert.equal(six.ok, false)
  assert.match(six.errors.join(), /최대 5개/)

  const registry = {
    'x.send': { label: '보내기', risk: 'irreversible', check: () => null, run: async () => ({}) },
    'x.note': { label: '메모', risk: 'write', check: () => null, run: async () => ({}), undo: async () => ({}) },
  }
  const last = validatePlan({ steps: [{ tool: 'x.note', args: {}, risk: 'write' }, { tool: 'x.send', args: {}, risk: 'irreversible' }] }, registry)
  assert.deepEqual(last, { ok: true, needsApproval: true })
  const middle = validatePlan({ steps: [{ tool: 'x.send', args: {}, risk: 'irreversible' }, { tool: 'x.note', args: {}, risk: 'write' }] }, registry)
  assert.equal(middle.ok, false)
  assert.match(middle.errors[0], /마지막에만/)
})

test('7. 원복 방법이 없는 쓰기 도구 → 거부', () => {
  const registry = { 'x.write': { label: '쓰기', risk: 'write', check: () => null, run: async () => ({}) } }
  const verdict = validatePlan({ steps: [{ tool: 'x.write', args: {}, risk: 'write' }] }, registry)
  assert.equal(verdict.ok, false)
  assert.match(verdict.errors[0], /원복 방법이 없는/)
})

test('위험도를 낮춰 적어 결재를 피하려는 계획·잘못된 인자·빈 계획 → 거부', () => {
  const lie = validatePlan({ steps: [{ tool: 'test.write', args: { text: 'x' }, risk: 'read' }] })
  assert.equal(lie.ok, false)
  assert.match(lie.errors[0], /위험도 표기/)
  assert.equal(validatePlan({ steps: [{ ...write(), args: { text: '' } }] }).ok, false)
  assert.equal(validatePlan({ steps: [{ ...write(), args: { text: 'x', sql: 'drop' } }] }).ok, false)
  assert.equal(validatePlan({ steps: [] }).ok, false)
  assert.equal(validatePlan(null).ok, false)
  assert.equal(validatePlan([]).ok, false)
})
