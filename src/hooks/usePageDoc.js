import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { loadPage, savePage } from '../lib/db.js'

const DEBOUNCE_MS = 1500
const RETRY_MS = 5000

// 페이지(경로)의 제목·본문을 Supabase에서 불러오고, 입력을 멈추면 1.5초 뒤 조용히 저장한다.
// - path는 컴포넌트가 사는 동안 바뀌지 않는다고 가정한다. (호출하는 쪽에서 key={path}로 새로 만든다.)
// - 불러오기에 실패하면 status가 'error'가 되어 에디터를 열지 않는다. (빈 내용으로 저장된 글을 덮어쓰는 사고 방지)
export default function usePageDoc(path) {
  const [state, setState] = useState({ status: 'loading', doc: null })
  const pending = useRef({})
  const timer = useRef(null)
  const isSaving = useRef(false)
  // 저장 상태: idle(변경 없음) → saving(입력/저장 중) → saved(저장됨), 실패하면 error
  const [saveState, setSaveState] = useState('idle')

  const load = useCallback(async () => {
    setState({ status: 'loading', doc: null })
    try {
      setState({ status: 'ready', doc: await loadPage(path) })
    } catch {
      setState({ status: 'error', doc: null })
    }
  }, [path])

  useEffect(() => {
    load()
  }, [load])

  const flush = useCallback(
    async ({ silent = false } = {}) => {
      clearTimeout(timer.current)
      if (isSaving.current || Object.keys(pending.current).length === 0) return
      const values = pending.current
      pending.current = {}
      isSaving.current = true
      let saved = false
      try {
        await savePage(path, values)
        saved = true
        if (Object.keys(pending.current).length === 0) setSaveState('saved')
      } catch {
        // 실패한 변경분은 되돌려 두되, 그 사이에 더 새로 입력된 값은 유지한다.
        pending.current = { ...values, ...pending.current }
        if (!silent) {
          setSaveState('error')
          toast.error('자동 저장에 실패했습니다. 잠시 후 다시 시도합니다', { id: 'autosave-error' })
          timer.current = setTimeout(flush, RETRY_MS)
        }
      } finally {
        isSaving.current = false
      }
      // 저장하는 동안 새로 입력된 내용이 있으면 이어서 저장한다. (떠나는 중이면 바로, 아니면 디바운스 후)
      if (saved && Object.keys(pending.current).length > 0) {
        if (silent) await flush({ silent: true })
        else timer.current = setTimeout(flush, DEBOUNCE_MS)
      }
    },
    [path],
  )

  // 제목/본문이 바뀔 때마다 부른다. 마지막 입력 1.5초 뒤에 한 번만 저장된다.
  const change = useCallback(
    (field, value) => {
      pending.current[field] = value
      setSaveState('saving')
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, DEBOUNCE_MS)
    },
    [flush],
  )

  // 화면을 떠나거나(다른 페이지로 이동), 앱이 백그라운드로 가면 기다리지 않고 바로 저장한다.
  useEffect(() => {
    const handleHide = () => document.visibilityState === 'hidden' && flush({ silent: true })
    document.addEventListener('visibilitychange', handleHide)
    window.addEventListener('pagehide', handleHide)
    return () => {
      document.removeEventListener('visibilitychange', handleHide)
      window.removeEventListener('pagehide', handleHide)
      flush({ silent: true })
    }
  }, [flush])

  return { ...state, saveState, change, reload: load }
}
