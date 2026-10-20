import { supabase } from './supabaseClient.js'

function getClient() {
  if (!supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  return supabase
}

// 목록 조회 (최신순). 데이터가 없으면 빈 배열을 돌려준다.
export async function listRows(table) {
  const { data, error } = await getClient().from(table).select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// 새 행 추가
export async function insertRow(table, values) {
  const { data, error } = await getClient().from(table).insert(values).select().single()
  if (error) throw error
  return data
}

// 행 수정 (바꿀 필드만 전달)
export async function updateRow(table, id, values) {
  const { error } = await getClient().from(table).update(values).eq('id', id)
  if (error) throw error
}

// 행 삭제
export async function deleteRow(table, id) {
  const { error } = await getClient().from(table).delete().eq('id', id)
  if (error) throw error
}

// 데이터가 바뀌었음을 화면의 목록들에 알려 다시 불러오게 한다.
export function notifyDataChange() {
  window.dispatchEvent(new Event('datachange'))
}
