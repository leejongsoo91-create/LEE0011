import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseRegOutput, readSecret, regCommand } from './dev-log.mjs'

// 가짜 값만 쓴다 (실제 비밀 값 아님)
const FAKE = 'fake_secret_for_test_0123456789abcdef'
const REG_OUT = `\r\nHKEY_CURRENT_USER\\Environment\r\n    DEV_LOG_SECRET    REG_SZ    ${FAKE}\r\n\r\n`

test('레지스트리 프로그램: Windows는 reg, WSL은 reg.exe, 그 밖은 없음', () => {
  assert.equal(regCommand('win32', {}), 'reg')
  assert.equal(regCommand('linux', { WSL_DISTRO_NAME: 'Ubuntu' }), 'reg.exe')
  assert.equal(regCommand('linux', {}), null)
  assert.equal(regCommand('darwin', {}), null)
})

test('reg 출력에서 값만 뽑고 Windows 줄바꿈은 붙지 않는다', () => {
  assert.equal(parseRegOutput(REG_OUT), FAKE)
  assert.equal(parseRegOutput(REG_OUT.replace('REG_SZ', 'REG_EXPAND_SZ')), FAKE)
  assert.equal(parseRegOutput('오류: 지정된 레지스트리 키 또는 값을 찾을 수 없습니다.'), '')
})

test('창의 환경변수가 있으면 레지스트리를 보지 않는다', () => {
  const run = () => assert.fail('레지스트리를 읽으면 안 됨')
  assert.equal(readSecret({ env: { DEV_LOG_SECRET: ` ${FAKE} ` }, platform: 'linux', run }), FAKE)
})

test('WSL에서는 reg.exe로 Windows 값을 읽는다', () => {
  const calls = []
  const run = (command, args) => (calls.push([command, ...args]), REG_OUT)
  assert.equal(readSecret({ env: { WSL_DISTRO_NAME: 'Ubuntu' }, platform: 'linux', run }), FAKE)
  assert.deepEqual(calls, [['reg.exe', 'query', 'HKCU\\Environment', '/v', 'DEV_LOG_SECRET']])
})

test('reg가 실패하거나 WSL이 아니면 빈 값', () => {
  const fail = () => { throw new Error('없음') }
  assert.equal(readSecret({ env: { WSL_DISTRO_NAME: 'Ubuntu' }, platform: 'linux', run: fail }), '')
  assert.equal(readSecret({ env: {}, platform: 'linux', run: () => REG_OUT }), '')
})

test('직접 실행하면 main이 돈다: 인자가 없으면 사용법을 찍고 종료 코드 2 (한글 경로 포함)', () => {
  const script = fileURLToPath(new URL('./dev-log.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /쓰는 법/)
})
