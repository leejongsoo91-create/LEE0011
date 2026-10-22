import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { insertRow, notifyDataChange, updateRow } from '../lib/db.js'
import { notifyScheduleAdded } from '../lib/notify.js'

// 현재 페이지(경로)에 따라 항목이 저장될 테이블
const tableByPath = {
  '/work': 'work',
  '/hobbies': 'hobbies',
  '/schedule': 'schedule',
  '/investments': 'investments',
}

// 테이블별 새 행의 기본값
function buildValues(table, { title, schedule, content, investment }) {
  if (table === 'work') return { title, status: 'Todo', progress: 0, content }
  if (table === 'hobbies') return { title, details: '', content }
  if (table === 'investments') {
    return {
      ticker: investment.ticker.trim().toUpperCase(),
      name: title === '제목 없음' ? null : title,
      avg_price: investment.avg_price === '' ? null : Number(investment.avg_price),
      quantity: Number(investment.quantity) || 0,
    }
  }
  // 시간을 정하지 않은 일정은 종일 일정이라 알림도 없다.
  // (시간 칸이 없는 일정은 새 컬럼을 보내지 않아, 데이터베이스 업데이트 전에도 저장된다.)
  if (!schedule.time) return { title, date: schedule.date }
  return {
    title,
    date: schedule.date,
    time: schedule.time,
    remind_before_min: schedule.remind === '' ? null : Number(schedule.remind),
  }
}

// 일정의 시간·알림 컬럼은 나중에 추가된 것이라, 데이터베이스에 아직 없을 수 있다.
const optionalColumns = ['remind_before_min', 'time', 'reminded_at']

// 저장(추가 또는 수정)을 실행한다. 데이터베이스에 없는 선택 컬럼 때문에 거절되면
// 그 값만 빼고 다시 저장하고, 빠진 컬럼 이름을 함께 돌려줘서 안내할 수 있게 한다.
async function saveWithFallback(values, run) {
  const current = { ...values }
  const dropped = []
  for (;;) {
    try {
      return { dropped, result: await run(current) }
    } catch (error) {
      const column = /'([a-z_]+)' column/.exec(error?.message ?? '')?.[1]
      if (!optionalColumns.includes(column) || !(column in current)) throw error
      delete current[column]
      dropped.push(column)
    }
  }
}

// 수정한 일정을 저장할 값으로 만든다.
// 날짜·시간·알림 시점 중 하나라도 바뀌면 reminded_at을 비워서, 바뀐 시각에 알림이 다시 가게 한다.
// (제목만 고쳤을 때는 그대로 두어 같은 알림이 또 가지 않는다.)
function buildScheduleUpdate(row, schedule, title) {
  const values = { title, date: schedule.date }
  const time = schedule.time || null
  const remind = time && schedule.remind !== '' ? Number(schedule.remind) : null
  // 시간·알림 컬럼이 없는 데이터베이스에서는 시간을 쓰지 않는 한 그 컬럼을 건드리지 않는다.
  if (time || 'time' in row) {
    values.time = time
    values.remind_before_min = remind
    const changed =
      row.date !== schedule.date || (row.time ? row.time.slice(0, 5) : null) !== time || (row.remind_before_min ?? null) !== remind
    if (changed) values.reminded_at = null
  }
  return values
}

// 빠진 컬럼에 맞는 안내 문구 (일정은 저장됐지만 일부 값은 저장되지 않았다는 뜻)
function describeDropped(dropped) {
  if (dropped.includes('time')) return '일정은 저장됐지만 시간은 저장되지 않았어요. Supabase의 schedule 테이블에 time 컬럼이 필요해요'
  return '일정은 저장됐지만 알림 설정은 저장되지 않았어요. Supabase에서 알림용 SQL(remind_before_min 컬럼)을 실행해 주세요'
}

// 모달의 입력값을 Supabase에 저장(추가 또는 수정)한다. 저장 중에는 isSaving이 true.
export default function useItemSave({ editing, onSaved }) {
  const { pathname } = useLocation()
  const [isSaving, setIsSaving] = useState(false)
  const table = editing ? editing.table : tableByPath[pathname]

  const save = async (input) => {
    if (isSaving) return
    if (!table) {
      toast('Work, Hobbies, Schedule, Investments 페이지에서 항목을 추가할 수 있어요')
      return
    }
    if (table === 'investments' && !input.investment.ticker.trim()) {
      toast.error('티커를 입력해 주세요')
      return
    }
    if (table === 'schedule' && !input.schedule.date) {
      toast.error('날짜를 선택해 주세요')
      return
    }
    const title = input.title.trim() || '제목 없음'
    setIsSaving(true)
    let dropped = []
    try {
      if (editing) {
        // 수정: 새로 만들지 않고, 편집 중인 항목의 id로 update 한다. (텔레그램 알림은 새 일정을 등록할 때만 보낸다.)
        const values =
          table === 'schedule'
            ? buildScheduleUpdate(editing.row, input.schedule, title)
            : input.content
              ? { title, content: input.content }
              : { title }
        dropped = (await saveWithFallback(values, (current) => updateRow(table, editing.row.id, current))).dropped
      } else {
        const result = await saveWithFallback(buildValues(table, { ...input, title }), (current) => insertRow(table, current))
        dropped = result.dropped
        // 새 일정이 저장된 뒤에만 텔레그램 알림을 보낸다. 기다리지 않으므로 화면 동작은 그대로다.
        if (table === 'schedule') {
          const time = dropped.includes('time') ? '' : input.schedule.time
          notifyScheduleAdded({ title, date: input.schedule.date, time })
        }
      }
      notifyDataChange()
      toast(editing ? (table === 'schedule' ? '일정이 수정되었습니다' : '성공적으로 수정되었습니다') : '성공적으로 추가되었습니다')
      if (dropped.length > 0) toast.warning(describeDropped(dropped), { duration: 9000 })
      onSaved()
    } catch (error) {
      // 원인을 개발자 도구(F12) 콘솔에서 확인할 수 있게 남긴다.
      console.error('[저장 실패]', table, error)
      toast.error('저장에 실패했습니다. 잠시 후 다시 시도해 주세요')
      setIsSaving(false)
    }
  }

  return { table, save, isSaving }
}
