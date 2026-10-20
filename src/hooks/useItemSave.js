import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { insertRow, notifyDataChange, updateRow } from '../lib/db.js'

// 현재 페이지(경로)에 따라 항목이 저장될 테이블
const tableByPath = { '/work': 'work', '/hobbies': 'hobbies', '/schedule': 'schedule' }

// 테이블별 새 행의 기본값
function buildValues(table, { title, date, content }) {
  if (table === 'work') return { title, status: 'Todo', progress: 0, content }
  if (table === 'hobbies') return { title, details: '', content }
  return { title, date }
}

// 모달의 입력값을 Supabase에 저장(추가 또는 수정)한다.
export default function useItemSave({ editing, onSaved }) {
  const { pathname } = useLocation()
  const table = editing ? editing.table : tableByPath[pathname]

  const save = async ({ title, date, content }) => {
    if (!table) {
      toast('Work, Hobbies, Schedule 페이지에서 항목을 추가할 수 있어요')
      return
    }
    const name = title.trim() || '제목 없음'
    try {
      if (editing) {
        await updateRow(table, editing.row.id, content ? { title: name, content } : { title: name })
      } else {
        await insertRow(table, buildValues(table, { title: name, date, content }))
      }
      notifyDataChange()
      toast(editing ? '항목이 수정되었습니다' : '항목이 추가되었습니다')
      onSaved()
    } catch {
      toast.error('저장에 실패했습니다. 잠시 후 다시 시도해 주세요')
    }
  }

  return { table, save }
}
