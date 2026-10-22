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
function buildValues(table, { title, date, content, investment }) {
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
  return { title, date }
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
    if (table === 'schedule' && !input.date) {
      toast.error('날짜를 선택해 주세요')
      return
    }
    const title = input.title.trim() || '제목 없음'
    setIsSaving(true)
    try {
      if (editing) {
        await updateRow(table, editing.row.id, input.content ? { title, content: input.content } : { title })
      } else {
        await insertRow(table, buildValues(table, { ...input, title }))
        // 새 일정이 저장된 뒤에만 텔레그램 알림을 보낸다. 기다리지 않으므로 화면 동작은 그대로다.
        if (table === 'schedule') notifyScheduleAdded({ title, date: input.date })
      }
      notifyDataChange()
      toast(editing ? '성공적으로 수정되었습니다' : '성공적으로 추가되었습니다')
      onSaved()
    } catch {
      toast.error('저장에 실패했습니다. 잠시 후 다시 시도해 주세요')
      setIsSaving(false)
    }
  }

  return { table, save, isSaving }
}
