import { supabase } from './supabaseClient.js'

function getClient() {
  if (!supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  return supabase
}

// 이메일/비밀번호로 로그인한다.
export async function signIn(email, password) {
  const { error } = await getClient().auth.signInWithPassword({ email, password })
  if (error) throw error
}

// 회원가입한다. 이메일 인증이 켜져 있으면 session이 없고, 켜져 있지 않으면 바로 로그인된다.
export async function signUp(email, password) {
  const { data, error } = await getClient().auth.signUp({ email, password })
  if (error) throw error
  return { needsConfirmation: !data.session }
}

export async function signOut() {
  const { error } = await getClient().auth.signOut()
  if (error) throw error
}

// Supabase가 돌려주는 영어 오류를 알기 쉬운 한국어로 바꾼다.
export function describeAuthError(error) {
  const message = error?.message ?? ''
  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다'
  if (message.includes('Email not confirmed')) return '이메일 인증을 먼저 완료해 주세요'
  if (message.includes('already registered')) return '이미 가입된 이메일입니다'
  if (message.includes('at least')) return '비밀번호는 6자 이상이어야 합니다'
  if (message.includes('환경 변수')) return 'Supabase 설정(.env.local)을 확인해 주세요'
  return '잠시 후 다시 시도해 주세요'
}
