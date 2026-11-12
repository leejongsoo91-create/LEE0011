import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const DEBOUNCE_MS = 1500
const RETRY_MS = 5000

// 입력을 모았다가 마지막 입력 1.5초 뒤 save(바뀐 값들)로 한 번에 저장한다.
// - save는 바뀌지 않는 함수여야 한다 (useCallback). 컴포넌트가 사는 동안 같은 대상에 저장한다고 가정한다.
// - 실패하면 "저장 실패"를 보이고 5초 뒤 다시 시도한다. 그 사이 입력은 잃지 않는다.
// - 화면을 떠나거나 앱이 백그라운드로 가면 기다리지 않고 바로 저장한다.
export default function useAutoSave(save) {
  const pending = useRef({})
  const timer = useRef(null)
  const isSaving = useRef(false)
  // 저장 상태: idle(변경 없음) → saving(입력/저장 중) → saved(저장됨), 실패하면 error
  const [saveState, setSaveState] = useState('idle')

  const flush = useCallback(
    async ({ silent = false } = {}) => {
      clearTimeout(timer.current)
      if (isSaving.current || Object.keys(pending.current).length === 0) return
      const values = pending.current
      pending.current = {}
      isSaving.current = true
      let saved = false
      try {
        await save(values)
        saved = true
        if (Object.keys(pending.current).length === 0) setSaveState('saved')
      } catch {
        // 실패한 변경분은 되돌려 두되, 그 사이에 더 새로 입력된 값은 유지한다.
        pending.current = { ...values, ...pending.current }
        if (!silent) {
          setSaveState('error')
          toast.error('자동 저장에 실패했습니다. 잠시 후 다시 시도합니다', { id: 'autosave-error' })
          timer.current = setTimeout(flush, RETRY_MS)
        } else {
          // 화면을 떠나며 저장하다 실패하면 다시 시도할 수 없으니, 알리기라도 한다
          toast.error('마지막 수정 내용을 저장하지 못했어요. 다시 열어 확인해 주세요', { id: 'autosave-error' })
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
    [save],
  )

  // 값이 바뀔 때마다 부른다. 마지막 입력 1.5초 뒤에 한 번만 저장된다.
  const change = useCallback(
    (field, value) => {
      pending.current[field] = value
      setSaveState('saving')
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, DEBOUNCE_MS)
    },
    [flush],
  )

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

  return { saveState, change }
}
