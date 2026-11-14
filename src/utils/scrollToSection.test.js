import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPlainClick } from './scrollToSection.js'

const click = (extra = {}) => ({ metaKey: false, ctrlKey: false, shiftKey: false, button: 0, ...extra })

test('보통 왼쪽 클릭은 같은 화면 스크롤로 처리한다', () => {
  assert.equal(isPlainClick(click()), true)
})

test('보조키 클릭과 가운데 버튼은 브라우저에 맡긴다', () => {
  assert.equal(isPlainClick(click({ metaKey: true })), false)
  assert.equal(isPlainClick(click({ ctrlKey: true })), false)
  assert.equal(isPlainClick(click({ shiftKey: true })), false)
  assert.equal(isPlainClick(click({ button: 1 })), false)
})
