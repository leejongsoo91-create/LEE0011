import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const REFRESH_MS = 60_000

// 중앙관제의 에이전트 작업 요약을 서버 함수(/api/control-summary)에서 불러온다.
// 60초마다, 그리고 다른 곳에서 데이터가 바뀌면(datachange) 다시 불러온다.
// 실패해도 화면 전체를 막지 않고 error만 채운다 (로컬 개발 서버에는 /api가 없다).
export default function useControlSummary() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: auth } = (await supabase?.auth.getSession()) ?? {}
        const token = auth?.session?.access_token
        if (!token) throw new Error('로그인이 필요합니다')
        const response = await fetch('/api/control-summary', { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) throw new Error(`요약을 불러오지 못했습니다 (${response.status})`)
        const body = await response.json()
        if (!cancelled) {
          setData(body)
          setError(null)
        }
      } catch (caught) {
        if (!cancelled) setError(caught.message || '요약을 불러오지 못했습니다')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [version])

  const reload = useCallback(() => setVersion((prev) => prev + 1), [])

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS)
    window.addEventListener('datachange', reload)
    return () => {
      clearInterval(timer)
      window.removeEventListener('datachange', reload)
    }
  }, [reload])

  return { data, error, isLoading, reload }
}
