// agent_tasks 표 읽기·쓰기. 상태 전환은 모두 "지금 이 상태일 때만 바꾼다"는 조건부 업데이트 한 번으로 한다.
// 같은 버튼을 두 번 눌러도, 동시에 눌러도 한 번만 성공한다.

import { rest } from './supabase.js'

const TABLE = 'agent_tasks'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isTaskId = (value) => UUID.test(value ?? '')

// 새 작업을 만든다. 같은 source_update_id가 이미 있으면(텔레그램 재전송) 만들지 않고 null을 돌려준다.
export async function createTask({ query, sourceUpdateId, status, plan, planHash, expiresAt, log }) {
  const rows = await rest(`${TABLE}?on_conflict=source_update_id`, {
    method: 'POST',
    prefer: 'resolution=ignore-duplicates,return=representation',
    body: {
      task_query: query,
      source_update_id: sourceUpdateId,
      status,
      plan_payload: plan,
      plan_hash: planHash,
      expires_at: expiresAt,
      event_logs: [{ at: new Date().toISOString(), to: status, ...log }],
    },
  })
  return rows?.[0] ?? null
}

export async function getTask(id) {
  if (!isTaskId(id)) return null
  const rows = await rest(`${TABLE}?id=eq.${id}&select=*`)
  return rows?.[0] ?? null
}

// task.status에서 to로 바꾼다. 그 사이에 다른 요청이 먼저 바꿨다면 null을 돌려준다.
export async function transition(task, to, { log, patch = {} } = {}) {
  const entry = { at: new Date().toISOString(), from: task.status, to, ...log }
  const rows = await rest(`${TABLE}?id=eq.${task.id}&status=eq.${task.status}`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: { ...patch, status: to, event_logs: [...(task.event_logs ?? []), entry] },
  })
  return rows?.[0] ?? null
}
