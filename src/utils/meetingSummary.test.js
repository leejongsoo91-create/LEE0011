import test from 'node:test'
import assert from 'node:assert/strict'
import { dueLabel, meetingTime, summaryBlocks } from './meetingSummary.js'

test('요약 Markdown → 블록: 제목·할 일·목록·인용·문단, 굵은 글씨·기울임 정리', () => {
  const md = ['## 1. **촬영** 일정', '', '설명 문장', '### 작업 계획', '- [ ] 씬 정리 -- *가람* 2026-11-14', '- [x] 끝난 일', '- 그냥 목록', '> **AI 제안**', '>', '#### 깊은 제목'].join('\n')
  assert.deepEqual(summaryBlocks(md), [
    { type: 'heading', level: 2, text: '1. 촬영 일정' },
    { type: 'text', text: '설명 문장' },
    { type: 'heading', level: 3, text: '작업 계획' },
    { type: 'todo', done: false, text: '씬 정리 -- 가람 2026-11-14' },
    { type: 'todo', done: true, text: '끝난 일' },
    { type: 'item', text: '그냥 목록' },
    { type: 'quote', text: 'AI 제안' },
    { type: 'heading', level: 3, text: '깊은 제목' },
  ])
  assert.deepEqual(summaryBlocks(null), [])
  assert.deepEqual(summaryBlocks('<script>alert(1)</script>'), [{ type: 'text', text: '<script>alert(1)</script>' }], '글자로만 다룬다')
})

test('기울임 별표: 글자를 감싼 별표만 지우고 계산식 별표는 남긴다', () => {
  const blocks = summaryBlocks(['*발언자 2*: 다음 촬영은 **토요일**', '5 * 3 = 15', '2*3*4 = 24', '- *가람* 담당'].join('\n'))
  assert.deepEqual(blocks, [
    { type: 'text', text: '발언자 2: 다음 촬영은 토요일' },
    { type: 'text', text: '5 * 3 = 15' },
    { type: 'text', text: '2*3*4 = 24' },
    { type: 'item', text: '가람 담당' },
  ])
})

test('시각·마감일 표시 (한국 시간)', () => {
  assert.equal(meetingTime('2026-11-12T08:42:32.000Z'), '11/12(목) 17:42')
  assert.equal(meetingTime('2026-11-12T15:30:00Z'), '11/13(금) 00:30')
  assert.equal(meetingTime(null), '')
  assert.equal(dueLabel('2026-11-05'), '11/5 마감')
  assert.equal(dueLabel(null), '')
})
