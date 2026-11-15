import test from 'node:test'
import assert from 'node:assert/strict'
import { taskLabel } from './taskLabel.js'

test('Plaud 작업 문장은 앞부분을 "회의 녹음:"으로 줄인다', () => {
  assert.equal(taskLabel('Plaud 회의 녹음을 업무 탭에 넣기: 11-13 회의: 관절·포즈'), '회의 녹음: 11-13 회의: 관절·포즈')
  assert.equal(taskLabel('Plaud 회의 녹음을 업무 탭에 넣기: '), '회의 녹음')
})

test('다른 작업 문장과 빈 값은 그대로', () => {
  assert.equal(taskLabel('내일 3시 치과 일정 잡아줘'), '내일 3시 치과 일정 잡아줘')
  assert.equal(taskLabel('회의 녹음 정리'), '회의 녹음 정리')
  assert.equal(taskLabel(null), '')
  assert.equal(taskLabel(undefined), '')
})
