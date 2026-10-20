import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 환경 변수(.env.local)가 없으면 null. 이때 데이터 요청은 오류로 처리되어 토스트가 뜬다.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
