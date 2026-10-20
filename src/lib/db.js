import { supabase } from './supabaseClient.js'

function getClient() {
  if (!supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  return supabase
}

// 로그인한 사용자의 id를 돌려준다. 로그인하지 않았으면 오류.
async function getUserId() {
  const { data, error } = await getClient().auth.getSession()
  const userId = data.session?.user.id
  if (error || !userId) throw new Error('로그인이 필요합니다.')
  return userId
}

// 내 목록 조회 (최신순). 데이터가 없으면 빈 배열을 돌려준다.
export async function listRows(table) {
  const userId = await getUserId()
  const { data, error } = await getClient()
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// 새 행 추가. 내 user_id가 함께 저장된다.
export async function insertRow(table, values) {
  const userId = await getUserId()
  const { data, error } = await getClient().from(table).insert({ ...values, user_id: userId }).select().single()
  if (error) throw error
  return data
}

// 내 행 수정 (바꿀 필드만 전달)
export async function updateRow(table, id, values) {
  const userId = await getUserId()
  const { error } = await getClient().from(table).update(values).eq('id', id).eq('user_id', userId)
  if (error) throw error
}

// 내 행 삭제
export async function deleteRow(table, id) {
  const userId = await getUserId()
  const { error } = await getClient().from(table).delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

// 데이터가 바뀌었음을 화면의 목록들에 알려 다시 불러오게 한다.
export function notifyDataChange() {
  window.dispatchEvent(new Event('datachange'))
}
