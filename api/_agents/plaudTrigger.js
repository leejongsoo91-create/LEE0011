// Plaud 받은함 → 결재 요청. /api/agent-cron(1분마다)이 부른다.
//
//   받은함   : plaud_inbox (/api/plaud-hook이 Zapier 요청을 그대로 담아 둔 곳)
//   계획     : 코드가 만든다 (work.import_meeting 1단계). AI를 부르지 않아 비용이 들지 않는다.
//   검사     : 텔레그램 지시와 같은 검증기(validatePlan)를 거친다. 통과 못 하면 결재 없이 FAILED + 알림
//   중복 방지 : agent_tasks.source_key = plaud:<시각·제목 해시> (unique). 이미 있으면 받은함에서 지우기만 한다
//   결재     : 항상 결재, 24시간 뒤 만료. 반려하면 버린다 (approval.js)
//   상태     : VALIDATING으로 만들고 PENDING으로 조건부 전환 (상태 머신을 건너뛰지 않는다)

import { hashPlan } from './plan.js'
import { PLAUD_APPROVAL_TTL_MS, importArgs, whenLabel } from './plaud.js'
import { approvalButtons, approvalText, validationFailedText } from './report.js'
import { getTool } from './registry.js'
import { rest } from './supabase.js'
import { sendMessage } from './telegram.js'
import { createTask, transition } from './tasks.js'
import { validatePlan } from './validator.js'

export const MAX_PLAUD_PER_RUN = 3
const TOOL = 'work.import_meeting'

export function buildPlaudPlan(args) {
  const tool = getTool(TOOL)
  return {
    version: 2,
    main: { program: 'code' },
    summary: 'Plaud 회의 녹음을 업무 탭에 넣는 계획입니다. 코드가 요약에서 할 일을 뽑았어요 (AI 미사용).',
    steps: [{ tool: TOOL, args, risk: tool.risk, dept: tool.dept }],
    review: { program: 'off', verdict: 'off', rounds: 0, comments: [] },
  }
}

const removeInbox = (id) => rest(`plaud_inbox?id=eq.${id}`, { method: 'DELETE' })

// 크론 한 번에 할 일. 돌려주는 값: { inbox, pending, duplicate, invalid, failed }
export async function runPlaudInbox({ chatId, now = Date.now(), limit = MAX_PLAUD_PER_RUN } = {}) {
  const rows = (await rest(`plaud_inbox?select=*&order=received_at.asc&limit=${limit}`)) ?? []
  const result = { inbox: rows.length, pending: 0, duplicate: 0, invalid: 0, failed: 0 }

  for (const row of rows) {
    const args = importArgs(row)
    const plan = buildPlaudPlan(args)
    const origin = { kind: 'plaud', title: args.title, when: whenLabel(args.recorded_at) }
    const query = `Plaud 회의 녹음을 업무 탭에 넣기: ${args.title}`
    const verdict = validatePlan(plan)

    const task = await createTask({
      query,
      sourceKey: row.source_key,
      status: verdict.ok ? 'VALIDATING' : 'FAILED',
      plan,
      planHash: hashPlan(plan),
      log: verdict.ok
        ? { agent: 'intake', event: 'CREATED', origin, note: 'Plaud 자동 수신' }
        : { agent: 'crosscheck', event: 'VALIDATION_FAILED', check: 'code', origin, errors: verdict.errors },
    })

    if (!task) {
      // 이미 같은 녹음으로 만든 작업이 있다 (Zapier 재전송·재요약)
      result.duplicate += 1
    } else if (!verdict.ok) {
      result.invalid += 1
      await sendMessage(chatId, validationFailedText(task, verdict.errors))
    } else {
      const pending = await transition(task, 'PENDING', {
        log: { agent: 'orchestrator', event: 'VALIDATED', review: 'off' },
        patch: { expires_at: new Date(now + PLAUD_APPROVAL_TTL_MS).toISOString() },
      })
      if (pending) {
        const sent = await sendMessage(chatId, approvalText(pending), approvalButtons(pending.id))
        if (sent.ok) {
          result.pending += 1
        } else {
          result.failed += 1
          console.error('[plaud] 결재 메시지를 보내지 못했어요', row.source_key)
          await transition(pending, 'FAILED', { log: { agent: 'orchestrator', event: 'SEND_FAILED', note: '결재 메시지를 보내지 못함' } }).catch(() => null)
        }
      }
    }
    // 작업으로 옮겼으니(또는 이미 있으니) 받은함에서 지운다. 요약은 작업의 계획에 남아 있다.
    await removeInbox(row.id)
  }
  return result
}
