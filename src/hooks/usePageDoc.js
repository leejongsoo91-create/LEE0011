import { useCallback, useEffect, useState } from 'react'
import { loadPage, savePage } from '../lib/db.js'
import useAutoSave from './useAutoSave.js'

// 페이지(경로)의 제목·본문을 Supabase에서 불러오고, 입력을 멈추면 1.5초 뒤 조용히 저장한다.
// - path는 컴포넌트가 사는 동안 바뀌지 않는다고 가정한다. (호출하는 쪽에서 key={path}로 새로 만든다.)
// - 불러오기에 실패하면 status가 'error'가 되어 에디터를 열지 않는다. (빈 내용으로 저장된 글을 덮어쓰는 사고 방지)
export default function usePageDoc(path) {
  const [state, setState] = useState({ status: 'loading', doc: null })

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

  const save = useCallback((values) => savePage(path, values), [path])
  const { saveState, change } = useAutoSave(save)

  return { ...state, saveState, change, reload: load }
}
