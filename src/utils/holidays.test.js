// 공휴일 표 검사: 실제 있는 날짜인지, 대체공휴일이 평일인지, 해마다 빠진 공휴일이 없는지, 달 요약 묶음.
// 실행: npm run test:utils

import test from 'node:test'
import assert from 'node:assert/strict'
import { HOLIDAYS, HOLIDAY_YEARS, hasHolidayData, holidayOf, monthHolidays } from './holidays.js'

const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = 일요일

test('모든 날짜가 실제 있는 날짜(YYYY-MM-DD)이고 이름이 비어 있지 않다', () => {
  for (const [date, name] of Object.entries(HOLIDAYS)) {
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10), date, `${date}는 없는 날짜`)
    assert.ok(name.trim(), `${date} 이름 없음`)
  }
})

test('대체공휴일은 모두 월~금이고, 바로 앞의 주말·공휴일에 이어진다', () => {
  for (const [date, name] of Object.entries(HOLIDAYS).filter(([, n]) => n === '대체공휴일')) {
    const day = weekday(date)
    assert.ok(day >= 1 && day <= 5, `${date} 대체공휴일이 주말`)
    // 하루 전이나 이틀 전이 주말이거나 공휴일이어야 한다
    const before = [1, 2, 3].map((n) => new Date(Date.parse(`${date}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10))
    assert.ok(before.some((d) => holidayOf(d) && holidayOf(d) !== '대체공휴일'), `${date} 앞에 원래 공휴일이 없음`)
  }
})

test('해마다 고정 공휴일과 설·추석 3일 연휴가 빠짐없이 있다', () => {
  for (const year of HOLIDAY_YEARS) {
    for (const md of ['01-01', '03-01', '05-01', '05-05', '06-06', '07-17', '08-15', '10-03', '10-09', '12-25']) {
      assert.ok(holidayOf(`${year}-${md}`), `${year}-${md} 빠짐`)
    }
    for (const name of ['설날', '추석', '부처님오신날']) {
      assert.equal(Object.entries(HOLIDAYS).filter(([d, n]) => d.startsWith(`${year}`) && n === name).length, 1, `${year} ${name}`)
    }
    for (const name of ['설날 연휴', '추석 연휴']) {
      assert.equal(Object.entries(HOLIDAYS).filter(([d, n]) => d.startsWith(`${year}`) && n === name).length, 2, `${year} ${name}`)
    }
  }
})

test('설날·추석 당일은 연휴 3일의 가운데', () => {
  for (const [date, name] of Object.entries(HOLIDAYS).filter(([, n]) => n === '설날' || n === '추석')) {
    const shift = (n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
    assert.equal(holidayOf(shift(-1)), `${name} 연휴`)
    assert.equal(holidayOf(shift(1)), `${name} 연휴`)
  }
})

test('보고서와 같은 날짜: 2026년 22일, 2027년 24일, 요일 확인', () => {
  const count = (year) => Object.keys(HOLIDAYS).filter((d) => d.startsWith(`${year}`)).length
  assert.equal(count(2026), 22)
  assert.equal(count(2027), 24)
  assert.equal(weekday('2026-02-17'), 2, '2026 설날 화요일')
  assert.equal(weekday('2026-09-25'), 5, '2026 추석 금요일')
  assert.equal(weekday('2027-02-07'), 0, '2027 설날 일요일')
  assert.equal(weekday('2027-09-15'), 3, '2027 추석 수요일')
  assert.equal(holidayOf('2026-06-03'), '지방선거일')
  assert.equal(holidayOf('2026-10-31'), null)
})

test('달 요약: 연휴는 하나로 묶고, 떨어진 날은 따로', () => {
  assert.deepEqual(monthHolidays(2026, 8), [{ start: 24, end: 26, name: '추석 연휴' }])
  assert.deepEqual(monthHolidays(2026, 4), [
    { start: 1, end: 1, name: '노동절' },
    { start: 5, end: 5, name: '어린이날' },
    { start: 24, end: 24, name: '부처님오신날' },
    { start: 25, end: 25, name: '대체공휴일' },
  ])
  assert.deepEqual(monthHolidays(2027, 1), [
    { start: 6, end: 8, name: '설날 연휴' },
    { start: 9, end: 9, name: '대체공휴일' },
  ])
  assert.deepEqual(monthHolidays(2026, 10), [])
  assert.equal(hasHolidayData(2026), true)
  assert.equal(hasHolidayData(2028), false)
})
