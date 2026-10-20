import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listRows } from '../lib/db.js'

// 테이블의 행 목록을 불러온다. 불러오는 동안 isLoading이 true이고,
// 실패하면 토스트를 띄운다. 다른 곳에서 데이터가 바뀌면 자동으로 다시 불러온다.
export default function useRows(table) {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    listRows(table)
      .then((data) => !cancelled && setRows(data))
      .catch(() => !cancelled && toast.error('데이터를 불러오는 데 실패했습니다', { id: 'load-error' }))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [table, version])

  useEffect(() => {
    const reload = () => setVersion((prev) => prev + 1)
    window.addEventListener('datachange', reload)
    return () => window.removeEventListener('datachange', reload)
  }, [])

  const reload = useCallback(() => setVersion((prev) => prev + 1), [])

  return { rows, setRows, isLoading, reload }
}
