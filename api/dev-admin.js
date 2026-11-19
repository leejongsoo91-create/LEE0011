// Vercel 함수: 중앙관제 개발 창 "데이터 관리" 탭의 정리 입구 (보고서 12 3단계).
// 화면은 dev_log·dev_work를 읽기만 하고(RLS), 정리(묶기·풀기·고치기·합치기·숨기기)는 여기서 서비스 롤 키로 한다.
//
// 보안: 로그인 토큰(Authorization: Bearer)으로 사용자를 확인하고 주인 계정만 허용한다 (/api/notify-schedule과 같은 방식).
//   로그인 없음 401, 주인 아님 403, POST 아님 405. 모든 조회·쓰기에 주인 user_id 조건을 붙인다.
//   입력은 기록 입구(_lib/devWork.js)와 같은 검사: 한글 작업 번호·분야·상태, 길이, 비밀 값 거부. 지우기는 없다(숨기기만).
// 정리할 때마다 한 줄 기록(dev_log, devops·확인·기록, 요약이 "데이터 정리:"로 시작)을 남긴다: 언제 무엇을 바꿨는지 되짚을 수 있게.
// 받아들인 위험 (보고서 12): 고치기 기록에는 바꾼 칸 이름만 남고 바꾸기 전 값은 남지 않는다.
// 합치기는 한 번에 처리되지 않아, 합치는 도중 같은 작업을 dev-work 스크립트가 고치면 그 변경이 덮일 수 있다 (혼자 쓰는 환경).
//
// 받는 본문(JSON):
//   { action: 'assign',   log_ids: [uuid…], work_key }        한 줄 기록을 작업에 묶기
//   { action: 'unassign', log_ids: [uuid…] }                  묶음 풀기
//   { action: 'hide',     target: 'log'|'work', ids: [uuid…], hidden: true|false }   숨기기·되살리기
//   { action: 'edit',     work_key, fields: { title?, reason?, changes?, areas?, status?, report_url? } }
//   { action: 'merge',    from: 작업 번호, into: 작업 번호 }   from의 커밋·파일·기록을 into로 옮기고 from은 숨김

import { ownerUserId } from './_agents/owner.js'
import { rest } from './_agents/supabase.js'
import { userIdFromToken } from './_lib/session.js'
import { AREAS, LIMITS, WORK_KEY, devWorkFields, mergeFiles } from './_lib/devWork.js'
import { looksSecret } from './dev-log.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_IDS = 200
const EDITABLE = ['title', 'reason', 'changes', 'areas', 'status', 'report_url']

const idList = (ids) => Array.isArray(ids) && ids.length > 0 && ids.length <= MAX_IDS && ids.every((id) => typeof id === 'string' && UUID.test(id))
const key = (value) => (typeof value === 'string' && WORK_KEY.test(value) ? value : null)
const badKey = (...values) => values.some((value) => typeof value === 'string' && value && !WORK_KEY.test(value))

// 본문 검사 → { action, … } 또는 { error }
export function parseAdmin(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'bad-request' }
  const { action } = body
  if (action === 'assign') {
    if (badKey(body.work_key)) return { error: 'bad-work-key' }
    if (!idList(body.log_ids) || !key(body.work_key)) return { error: 'bad-request' }
    return { action, ids: body.log_ids, work_key: body.work_key }
  }
  if (action === 'unassign') return idList(body.log_ids) ? { action, ids: body.log_ids } : { error: 'bad-request' }
  if (action === 'hide') {
    if (!['log', 'work'].includes(body.target) || !idList(body.ids) || typeof body.hidden !== 'boolean') return { error: 'bad-request' }
    return { action, target: body.target, ids: body.ids, hidden: body.hidden }
  }
  if (action === 'edit') {
    if (badKey(body.work_key)) return { error: 'bad-work-key' }
    const fields = body.fields
    if (!key(body.work_key) || !fields || typeof fields !== 'object' || Array.isArray(fields)) return { error: 'bad-request' }
    const names = Object.keys(fields)
    if (names.length === 0 || names.some((name) => !EDITABLE.includes(name))) return { error: 'bad-request' }
    // 보고서 링크를 비우면 지운다 (devWorkFields는 빈 링크를 "안 줌"으로 본다)
    const clearReport = 'report_url' in fields && (fields.report_url == null || fields.report_url === '')
    const parsed = devWorkFields({ work_key: body.work_key, ...fields }, looksSecret)
    if (parsed.error) return parsed
    const patch = Object.fromEntries(Object.entries(parsed.fields).filter(([name]) => name !== 'work_key'))
    if (clearReport) patch.report_url = null
    return { action, work_key: body.work_key, patch }
  }
  if (action === 'merge') {
    if (badKey(body.from, body.into)) return { error: 'bad-work-key' }
    if (!key(body.from) || !key(body.into) || body.from === body.into) return { error: 'bad-request' }
    return { action, from: body.from, into: body.into }
  }
  return { error: 'bad-request' }
}

// 두 작업을 합친 값 (into에 쓸 칸). 커밋·분야는 합집합, 파일 줄 수는 더하고, 바꾼 내용은 이어 붙이고,
// 이유는 into에 없을 때만 from 것을, 시작은 더 이른 쪽·끝은 더 늦은 쪽
export function mergedWork(into, from) {
  const at = (a, b, pick) => (a && b ? pick(a, b) : a || b || null)
  return {
    commits: [...new Set([...(into.commits ?? []), ...(from.commits ?? [])])].slice(0, LIMITS.commits),
    files: mergeFiles(into.files ?? [], from.files ?? []),
    areas: [...new Set([...(into.areas ?? []), ...(from.areas ?? [])])].filter((area) => AREAS.includes(area)),
    changes: [into.changes, from.changes].filter(Boolean).join('\n').slice(0, LIMITS.changes) || null,
    reason: into.reason || from.reason || null,
    started_at: at(into.started_at, from.started_at, (a, b) => (Date.parse(a) <= Date.parse(b) ? a : b)),
    finished_at: at(into.finished_at, from.finished_at, (a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)),
  }
}

const enc = encodeURIComponent
const inIds = (ids) => `in.(${ids.join(',')})`

async function findWork(uid, workKey) {
  const [row] = (await rest(`dev_work?select=*&user_id=eq.${uid}&work_key=eq.${enc(workKey)}`)) ?? []
  return row ?? null
}

async function patch(path, body) {
  const rows = await rest(path, { method: 'PATCH', prefer: 'return=representation', body })
  return Array.isArray(rows) ? rows.length : 0
}

// 숨긴 작업에는 묶기·고치기·합치기를 하지 않는다 (숨긴 작업에 묶인 기록은 어디에도 안 보이고, 합쳐진 작업을 또 합치면 줄 수가 두 번 더해짐)
const usable = (work) => (!work ? { error: 'no-work', status: 404 } : work.hidden ? { error: 'work-hidden', status: 400 } : null)

// 정리 한 건 처리 → { changed, summary } 또는 { error, status }
export async function runAdmin(op, uid) {
  if (op.action === 'assign') {
    const problem = usable(await findWork(uid, op.work_key))
    if (problem) return problem
    const changed = await patch(`dev_log?id=${inIds(op.ids)}&user_id=eq.${uid}`, { work_key: op.work_key })
    return { changed, summary: `데이터 정리: 기록 ${changed}줄을 ${op.work_key}에 묶음` }
  }
  if (op.action === 'unassign') {
    const changed = await patch(`dev_log?id=${inIds(op.ids)}&user_id=eq.${uid}`, { work_key: null })
    return { changed, summary: `데이터 정리: 기록 ${changed}줄의 작업 묶음을 풂` }
  }
  if (op.action === 'hide') {
    const table = op.target === 'log' ? 'dev_log' : 'dev_work'
    const changed = await patch(`${table}?id=${inIds(op.ids)}&user_id=eq.${uid}`, { hidden: op.hidden })
    const what = op.target === 'log' ? '기록' : '작업'
    return { changed, summary: `데이터 정리: ${what} ${changed}개 ${op.hidden ? '숨김' : '되살림'}` }
  }
  if (op.action === 'edit') {
    const work = await findWork(uid, op.work_key)
    const problem = usable(work)
    if (problem) return problem
    await patch(`dev_work?id=eq.${work.id}&user_id=eq.${uid}`, { ...op.patch, updated_at: new Date().toISOString() })
    const names = { title: '제목', reason: '이유', changes: '바꾼 내용', areas: '분야', status: '상태', report_url: '보고서' }
    return { changed: 1, summary: `데이터 정리: ${op.work_key} 고침 (${Object.keys(op.patch).map((name) => names[name]).join('·')})` }
  }
  if (op.action === 'merge') {
    const [from, into] = [await findWork(uid, op.from), await findWork(uid, op.into)]
    const problem = usable(from) ?? usable(into)
    if (problem) return problem
    // 한 번에 처리되지 않으므로, 중간에 실패해도 같은 합치기를 다시 했을 때 두 번 더해지지 않는 순서로 한다:
    // 기록 옮기기 → from 숨기기 → into에 합친 값 쓰기. from을 숨긴 뒤에는 같은 합치기가 work-hidden으로 막힌다.
    // (마지막 쓰기만 실패하면 숨긴 것 보기에서 from을 되살린 뒤 다시 합치면 된다)
    const moved = await patch(`dev_log?work_key=eq.${enc(op.from)}&user_id=eq.${uid}`, { work_key: op.into })
    await patch(`dev_work?id=eq.${from.id}&user_id=eq.${uid}`, { hidden: true, updated_at: new Date().toISOString() })
    await patch(`dev_work?id=eq.${into.id}&user_id=eq.${uid}`, { ...mergedWork(into, from), updated_at: new Date().toISOString() })
    return { changed: 1, summary: `데이터 정리: ${op.from}을 ${op.into}에 합침 (기록 ${moved}줄 옮김, ${op.from} 숨김)` }
  }
  return { error: 'bad-request', status: 400 }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method-not-allowed' })
  }
  try {
    const uid = await userIdFromToken(req.headers?.authorization)
    if (!uid) return res.status(401).json({ error: 'login-required' })
    if (uid !== (await ownerUserId())) return res.status(403).json({ error: 'forbidden' })

    const op = parseAdmin(req.body)
    if (op.error) return res.status(400).json({ error: op.error })
    const result = await runAdmin(op, uid)
    if (result.error) return res.status(result.status ?? 400).json({ error: result.error })

    // 정리 기록 (실패해도 정리 결과는 그대로 돌려준다). 작업 번호는 붙이지 않는다:
    // 붙이면 작업 정리 탭의 진행 줄 "확인" 단계와 DevOps 거르기에 정리 기록이 섞인다 (작업 번호는 요약에만)
    try {
      await rest('dev_log', {
        method: 'POST',
        prefer: 'return=minimal',
        body: { user_id: uid, agent: 'devops', kind: 'check', status: 'info', summary: result.summary.slice(0, 300) },
      })
    } catch (error) {
      console.error('[dev-admin] 정리 기록 실패', error?.message)
    }
    return res.status(200).json({ ok: true, changed: result.changed })
  } catch (error) {
    console.error('[dev-admin] 정리 실패', error?.message)
    return res.status(500).json({ error: 'store-failed' })
  }
}
