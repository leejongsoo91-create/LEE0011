import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findPtyId, oneLine, send } from './wmux-send.mjs'

// 가짜 wmux list-panes --json 결과 (실제 wmux 호출 없음)
const PANES = {
  panes: [
    { paneName: '메인', metadata: { label: '메인' }, surfacePtyIds: ['daemon-main'], stashed: false },
    { paneName: 'w4-28(claude)', metadata: { label: 'QA' }, surfacePtyIds: ['daemon-qa'], stashed: false },
    { paneName: '서버', metadata: {}, surfacePtyIds: ['daemon-srv'], stashed: false },
    { paneName: '옛 QA', metadata: {}, surfacePtyIds: ['daemon-old'], stashed: true },
  ],
}

test('창 이름이나 라벨로 ptyId를 찾고, 대소문자는 무시한다', () => {
  assert.equal(findPtyId(PANES, '메인'), 'daemon-main')
  assert.equal(findPtyId(PANES, 'qa'), 'daemon-qa')
  assert.equal(findPtyId(PANES, ' QA '), 'daemon-qa')
})

test('없는 창, 숨긴 창은 오류이고 지금 창 이름을 알려 준다', () => {
  assert.throws(() => findPtyId(PANES, '옛 QA'), /'옛 QA' 창이 없습니다\. 지금 창: 메인, w4-28\(claude\), 서버/)
  assert.throws(() => findPtyId({}, 'QA'), /지금 창: \(없음\)/)
})

test('같은 이름이 둘이면 보내지 않는다', () => {
  const twin = { panes: [...PANES.panes, { paneName: 'QA', surfacePtyIds: ['daemon-qa2'] }] }
  assert.throws(() => findPtyId(twin, 'QA'), /2개입니다/)
})

test('터미널 없는 창은 오류', () => {
  assert.throws(() => findPtyId({ panes: [{ paneName: 'QA', surfacePtyIds: [] }] }, 'QA'), /터미널이 없습니다/)
})

test('여러 줄은 한 줄로, cmd.exe 특수 글자는 안전한 글자로', () => {
  assert.equal(oneLine('통과\n  실패 0\r\n끝'), '통과 / 실패 0 / 끝')
  assert.equal(oneLine('a & b | c <d> "e" 100% ^'), "a ＆ b ｜ c ＜d＞ 'e' 100％ ＾")
  assert.equal(oneLine(null), '')
})

test('끝의 \\는 바꾸고, 맨 앞 ! / # -는 명령으로 읽히지 않게 앞에 붙인다', () => {
  assert.equal(oneLine('경로 C:\\tmp\\'), '경로 C:\\tmp＼')
  assert.equal(oneLine('!rm -rf'), '[전달] !rm -rf')
  assert.equal(oneLine('/exit'), '[전달] /exit')
  assert.equal(oneLine('--to x'), '[전달] --to x')
  assert.equal(oneLine('[QA 보고] 통과'), '[QA 보고] 통과')
})

test('탭이 여럿이면 Claude Code 탭으로, 못 찾으면 오류', () => {
  const multi = (agents) => ({ panes: [{ paneName: 'QA', surfacePtyIds: ['daemon-sh', 'daemon-cc'], agents }] })
  assert.equal(findPtyId(multi([{ agentName: 'Claude Code', ptyId: 'daemon-cc' }]), 'QA'), 'daemon-cc')
  assert.throws(() => findPtyId(multi([]), 'QA'), /탭이 2개인데/)
})

test('창 목록이 JSON이 아니면 원래 출력을 보여 준다', () => {
  assert.throws(() => send('QA', '안녕', () => 'Error: daemon down'), /창 목록을 읽지 못했습니다: Error: daemon down/)
})

test('너무 긴 줄은 500자로 자른다', () => {
  const line = oneLine('가'.repeat(600))
  assert.equal(line.length, 500)
  assert.ok(line.endsWith('…'))
})

test('send: 창을 찾고 ptyId로 한 줄을 보낸다', () => {
  const calls = []
  const run = (args) => (calls.push(args), args[0] === 'list-panes' ? JSON.stringify(PANES) : '')
  const result = send('메인', '[QA 보고] 통과\n자세히는 파일', run)
  assert.deepEqual(result, { ptyId: 'daemon-main', line: '[QA 보고] 통과 / 자세히는 파일' })
  assert.deepEqual(calls, [
    ['list-panes', '--json'],
    ['send', '[QA 보고] 통과 / 자세히는 파일', '--submit', '--to', 'daemon-main'],
  ])
})

test('send: 빈 내용은 wmux를 부르지 않는다', () => {
  const run = () => assert.fail('wmux를 부르면 안 됨')
  assert.throws(() => send('메인', '  \n ', run), /비어 있습니다/)
})
