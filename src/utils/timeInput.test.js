import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTimeText, isAmbiguousMidnight } from './timeInput.js'

test('숫자·콜론 형식', () => {
  for (const [input, want] of [
    ['14:30', '14:30'], ['14.30', '14:30'], ['1430', '14:30'], ['930', '09:30'], ['9:30', '09:30'],
    ['9', '09:00'], ['09', '09:00'], ['0', '00:00'], ['23:59', '23:59'], [' 7:05 ', '07:05'],
  ]) assert.equal(parseTimeText(input), want, input)
})

test('한국어 시·분·반', () => {
  for (const [input, want] of [
    ['9시', '09:00'], ['2시 30분', '02:30'], ['2시30', '02:30'], ['2시반', '02:30'], ['2시 반', '02:30'], ['14시', '14:00'],
  ]) assert.equal(parseTimeText(input), want, input)
})

test('오전·오후와 am·pm', () => {
  for (const [input, want] of [
    ['오후 2시', '14:00'], ['오후 2:30', '14:30'], ['오후2시반', '14:30'], ['저녁 7시', '19:00'], ['오전 9시', '09:00'],
    ['아침 9시', '09:00'], ['오전 12시', '00:00'], ['오전 0시', '00:00'], ['오후 12시', '12:00'], ['밤 11시', '23:00'],
    ['밤 1시', '01:00'], ['새벽 3시', '03:00'], ['낮 2시', '14:00'], ['낮 11시', '11:00'], ['낮 12시', '12:00'],
    ['１４：３０', '14:30'],
    ['2pm', '14:00'], ['2:30 PM', '14:30'], ['9am', '09:00'], ['12 p.m.', '12:00'], ['정오', '12:00'],
  ]) assert.equal(parseTimeText(input), want, input)
})

test('빈 칸은 시간 없음, 못 읽는 글은 null', () => {
  assert.equal(parseTimeText(''), '')
  assert.equal(parseTimeText('   '), '')
  assert.equal(parseTimeText(null), '')
  // 자정·밤 12시·저녁 12시는 날짜나 뜻이 헷갈려 일부러 못 읽음
  for (const input of ['25:00', '24', '14:75', '내일', '오후 13시', '12345', '2시 60분', 'abc', '자정', '밤 12시', '저녁 12시', '새벽 9시'])
    assert.equal(parseTimeText(input), null, input)
})

test('때 말의 경계', () => {
  for (const [input, want] of [
    ['밤 5시', '05:00'], ['밤 6시', '18:00'], ['새벽 6시', '06:00'], ['낮 6시', '18:00'], ['낮 9시', '09:00'],
    ['저녁 5시', '17:00'], ['저녁 11시', '23:00'], ['12am', '00:00'],
  ]) assert.equal(parseTimeText(input), want, input)
  for (const input of ['새벽 7시', '새벽 0시', '낮 7시', '낮 8시', '아침 12시', '오후 0시', '저녁 4시', '저녁 12시'])
    assert.equal(parseTimeText(input), null, input)
})

test('자정·밤 12시는 따로 알아본다', () => {
  for (const input of ['자정', '밤 12시', '밤12시', '밤 12:00']) assert.equal(isAmbiguousMidnight(input), true, input)
  for (const input of ['밤 11시', '12시', '오전 12시', '']) assert.equal(isAmbiguousMidnight(input), false, input)
})
