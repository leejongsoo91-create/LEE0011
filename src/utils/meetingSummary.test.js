import test from 'node:test'
import assert from 'node:assert/strict'
import { dueLabel, meetingTime, summaryBlocks } from './meetingSummary.js'

test('요약 Markdown → 블록: 제목·할 일·목록·인용·문단, 굵은 글씨 정리', () => {
  const md = ['## 1. **촬영** 일정', '', '설명 문장', '### 작업 계획', '- [ ] 씬 정리 -- *가람* 2026-11-14', '- [x] 끝난 일', '- 그냥 목록', '> **AI 제안**', '>', '#### 깊은 제목'].join('\n')
  assert.deepEqual(summaryBlocks(md), [
    { type: 'heading', level: 2, text: '1. 촬영 일정' },
    { type: 'text', text: '설명 문장' },
    { type: 'heading', level: 3, text: '작업 계획' },
    { type: 'todo', done: false, text: '씬 정리 -- *가람* 2026-11-14' },
    { type: 'todo', done: true, text: '끝난 일' },
    { type: 'item', text: '그냥 목록' },
    { type: 'quote', text: 'AI 제안' },
    { type: 'heading', level: 3, text: '깊은 제목' },
  ])
  assert.deepEqual(summaryBlocks(null), [])
  assert.deepEqual(summaryBlocks('<script>alert(1)</script>'), [{ type: 'text', text: '<script>alert(1)</script>' }], '글자로만 다룬다')
})

test('시각·마감일 표시 (한국 시간)', () => {
  assert.equal(meetingTime('2026-11-12T08:42:32.000Z'), '11/12(목) 17:42')
  assert.equal(meetingTime('2026-11-12T15:30:00Z'), '11/13(금) 00:30')
  assert.equal(meetingTime(null), '')
  assert.equal(dueLabel('2026-11-05'), '11/5 마감')
  assert.equal(dueLabel(null), '')
})
