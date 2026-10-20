import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

// 현재 로그인 세션을 돌려준다. 확인하는 동안 isLoading이 true이고,
// 로그인/로그아웃이 일어나면 자동으로 갱신된다.
export default function useSession() {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setIsLoading(false))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, isLoading }
}
