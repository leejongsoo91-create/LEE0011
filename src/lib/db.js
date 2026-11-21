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

// 목록에 쓰는 칸만 불러오는 표 (보고서 11 2단계). 본문(content)·회의 요약(summary_md)처럼 큰 칸은 목록에서 빼고,
// 상세 화면이 getRow로 한 행 전부를 따로 불러온다. 여기 없는 표는 전부(*) 불러온다.
// 칸을 더하려면 이 목록과 그 표를 읽는 화면(useRows)을 같이 본다.
const LIST_COLUMNS = {
  work: 'id, title, status, progress, due_date, assignee, meeting_id, created_at',
  work_meetings: 'id, title, recorded_at, created_at',
}
// 목록에서 최근 것만 불러오는 표. 개발 팀 기록(dev_log)은 5년 보관이라 관제 현황판에는 최근 300줄만 쓴다
// (기간별로 다 보는 곳은 개발 창, listDevLogs). 서버 한도(1000줄)에 걸려 최근 것이 빠지는 일도 막는다.
const LIST_LIMIT = { dev_log: 300 }

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
    .select(LIST_COLUMNS[table] ?? '*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT[table] ?? 1000)
  if (error) throw error
  return data ?? []
}

// 개발 창 (보고서 12): 작업 단위 목록. 파일 목록(files)은 크니 빼고, 펼칠 때 getRow로 따로 불러온다.
// 기간(start ≤ 시작 시각 < end)이나 검색어(q, 기간과 상관없이 전체)로 고르고, 둘 다 없으면 최근 것부터 limit개.
// 검색어는 미리 cleanQuery로 정리해서 넘긴다.
const WORK_COLUMNS = 'id, project, work_key, title, reason, changes, areas, commits, report_url, status, started_at, finished_at'
export async function listDevWorks({ start, end, q, project, limit = 500 } = {}) {
  const userId = await getUserId()
  // 데이터 관리 탭에서 숨긴 작업은 작업 정리 탭에 보이지 않는다
  let query = getClient().from('dev_work').select(WORK_COLUMNS).eq('user_id', userId).eq('hidden', false)
  if (project) query = query.eq('project', project)
  if (q) {
    const like = `%${q}%`
    const hash = /^[0-9a-f]{7,40}$/.test(q) ? `,commits.cs.{${q.slice(0, 7)}}` : ''
    query = query.or(`work_key.ilike.${like},title.ilike.${like},reason.ilike.${like},changes.ilike.${like}${hash}`)
  } else if (start && end) {
    query = query.gte('started_at', start).lt('started_at', end)
  }
  const { data, error } = await query.order('started_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data ?? []
}

// 개발 창: 한 줄 기록. 기간(start ≤ 시각 < end) 또는 작업 번호들(keys) 중 하나로 고른다.
const LOG_COLUMNS = 'id, project, agent, kind, status, summary, ref, work_key, created_at'
export async function listDevLogs({ start, end, keys } = {}) {
  const userId = await getUserId()
  let query = getClient().from('dev_log').select(LOG_COLUMNS).eq('user_id', userId).eq('hidden', false)
  query = keys ? query.in('work_key', keys) : query.gte('created_at', start).lt('created_at', end)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return data ?? []
}

// 개발 창 "데이터 관리" 탭 (보고서 12 3단계): 원본 기록·작업 표. 거르기 값은 화면이 정한 것만 넘긴다.
//   start·end: 기간(없으면 전체), hidden: true면 숨긴 것만 / false면 숨기지 않은 것만, offset: 더 보기
export async function listDevLogsAdmin({ start, end, project, agent, kind, status, unassigned, hidden = false, offset = 0, limit = 100 } = {}) {
  const userId = await getUserId()
  let query = getClient().from('dev_log').select(`${LOG_COLUMNS}, hidden`).eq('user_id', userId).eq('hidden', hidden)
  if (start && end) query = query.gte('created_at', start).lt('created_at', end)
  if (project) query = query.eq('project', project)
  if (agent) query = query.eq('agent', agent)
  if (kind) query = query.eq('kind', kind)
  if (status) query = query.eq('status', status)
  // 안 묶인 것만: 정리 기록("데이터 정리:")은 원래 작업에 안 묶이므로 뺀다 (현황 숫자와 같은 기준)
  if (unassigned) query = query.is('work_key', null).not('summary', 'like', '데이터 정리:%')
  const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (error) throw error
  return data ?? []
}

export async function listDevWorksAdmin({ start, end, project, area, status, noReason, hidden = false, offset = 0, limit = 100 } = {}) {
  const userId = await getUserId()
  let query = getClient().from('dev_work').select(`${WORK_COLUMNS}, hidden`).eq('user_id', userId).eq('hidden', hidden)
  if (start && end) query = query.gte('started_at', start).lt('started_at', end)
  if (project) query = query.eq('project', project)
  if (area) query = query.contains('areas', [area])
  if (status) query = query.eq('status', status)
  if (noReason) query = query.is('reason', null)
  const { data, error } = await query.order('started_at', { ascending: false }).range(offset, offset + limit - 1)
  if (error) throw error
  return data ?? []
}

// 데이터 관리 탭 현황 숫자: 한 줄 기록 수 · 작업에 안 묶인 기록 수 · 작업 수 (숨긴 것 빼고),
// 가장 오래된 기록 시각 (숨긴 것도 포함: 5년 삭제 기준). 정리 기록("데이터 정리:")은 원래 작업에 안 묶이므로 안 묶인 수에서 뺀다.
export async function devDataCounts() {
  const userId = await getUserId()
  const count = async (table, extra = (query) => query) => {
    const { count: total, error } = await extra(getClient().from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('hidden', false))
    if (error) throw error
    return total ?? 0
  }
  const [logs, unassigned, works, oldest] = await Promise.all([
    count('dev_log'),
    count('dev_log', (query) => query.is('work_key', null).not('summary', 'like', '데이터 정리:%')),
    count('dev_work'),
    getClient().from('dev_log').select('created_at').eq('user_id', userId).order('created_at', { ascending: true }).limit(1),
  ])
  if (oldest.error) throw oldest.error
  return { logs, unassigned, works, oldest: oldest.data?.[0]?.created_at ?? null }
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
