import { toast } from 'sonner'
import { deleteRow } from '../lib/db.js'

// 확인창에서 '확인'을 누르면 목록에서 행을 먼저 지우고(낙관적 갱신) Supabase에서 삭제한다.
// 실패하면 목록을 원래대로 되돌리고 에러 토스트를 띄운다.
export default function useRowDelete(table, setRows) {
  return async (id) => {
    // 실수로 지우지 않도록 확인을 받은 뒤에만 삭제를 시작한다.
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    let removed = null
    let removedIndex = -1
    setRows((prev) => {
      removedIndex = prev.findIndex((row) => row.id === id)
      removed = prev[removedIndex] ?? null
      return prev.filter((row) => row.id !== id)
    })
    try {
      await deleteRow(table, id)
      toast('삭제했습니다')
    } catch {
      if (removed) {
        setRows((prev) => {
          const next = [...prev]
          next.splice(Math.min(removedIndex, next.length), 0, removed)
          return next
        })
      }
      toast.error('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요')
    }
  }
}
