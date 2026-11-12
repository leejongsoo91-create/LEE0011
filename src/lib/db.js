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

// 같은 표를 여러 화면 조각이 동시에 부르면(예: 업무 탭의 요약 띠·회의 기록·칸반) 요청 하나를 같이 쓴다.
const inflight = new Map()

// 내 목록 조회 (최신순). 데이터가 없으면 빈 배열을 돌려준다. 부른 쪽마다 배열 복사본을 준다.
export async function listRows(table) {
  if (!inflight.has(table)) {
    const request = fetchRows(table).finally(() => {
      if (inflight.get(table) === request) inflight.delete(table)
    })
    inflight.set(table, request)
  }
  return [...(await inflight.get(table))]
}

async function fetchRows(table) {
  const userId = await getUserId()
  const { data, error } = await getClient()
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// 내 행 하나 조회. 없으면 null.
export async function getRow(table, id) {
  const userId = await getUserId()
  const { data, error } = await getClient().from(table).select('*').eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
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

// 내 행 중 column = value인 것을 한 번에 삭제 (예: 회의에 붙은 할 일 전부)
export async function deleteRowsWhere(table, column, value) {
  const userId = await getUserId()
  const { error } = await getClient().from(table).delete().eq(column, value).eq('user_id', userId)
  if (error) throw error
}

// 데이터가 바뀌었음을 화면의 목록들에 알려 다시 불러오게 한다.
// 쓰기 전에 시작된 요청을 같이 쓰면 옛 데이터를 받으므로, 알리기 전에 진행 중인 요청 공유를 끊는다.
export function notifyDataChange() {
  inflight.clear()
  window.dispatchEvent(new Event('datachange'))
}

// 페이지(경로)별 제목·본문 한 줄을 불러온다. 아직 저장된 적이 없으면 null.
export async function loadPage(path) {
  const userId = await getUserId()
  const { data, error } = await getClient()
    .from('pages')
    .select('title, content')
    .eq('user_id', userId)
    .eq('path', path)
    .maybeSingle()
  if (error) throw error
  return data
}

// 페이지의 제목/본문 중 바뀐 것만 저장한다. 없으면 만들고, 있으면 덮어쓴다.
export async function savePage(path, values) {
  const userId = await getUserId()
  const { error } = await getClient()
    .from('pages')
    .upsert({ ...values, user_id: userId, path, updated_at: new Date().toISOString() }, { onConflict: 'user_id,path' })
  if (error) throw error
}
