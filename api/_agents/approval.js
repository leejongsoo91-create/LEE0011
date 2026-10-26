// 텔레그램 업데이트 입구: 새 지시, [승인]/[반려] 버튼, 반려 사유 답장을 나눠 처리한다.
// 계획·검증은 orchestrator.js, 실행·원복은 executor.js가 맡는다.

import {
  APPROVAL_TTL_MS,
  MAX_REJECTS,
  planAndRoute,
  runApproved,
  startInstruction,
  sweepStale,
} from './orchestrator.js'
import { hashPlan } from './plan.js'
import { handleCommand, parseCommand } from './commands.js'
import { friendlyReason } from './errors.js'
import { REASON_PROMPT, approvalText, errorText } from './report.js'
import { answerCallbackQuery, editMessageText, forceReply, sendMessage } from './telegram.js'
import { appendLog, findAwaitingReason, getTask, isTaskId, transition } from './tasks.js'

export { APPROVAL_TTL_MS }

const isOwner = (chatId) => {
  const owner = process.env.TELEGRAM_CHAT_ID
  return Boolean(owner) && chatId != null && String(chatId) === String(owner)
}

// 주인 확인이 끝난 뒤의 처리에서 예상 못 한 오류가 나면, 서버 로그에만 남기지 않고 텔레그램으로도 알린다.
async function guard(chatId, work, { executing = false } = {}) {
  try {
    return await work()
  } catch (error) {
    console.error('[agents] 처리 중 오류', error)
    await sendMessage(chatId, errorText(friendlyReason(error), { executing }))
    return 'error'
  }
}

// 일반 메시지: (1) 남은 작업 정리 (2) 운영 명령 (3) 반려 사유 답장이면 재계획 (4) 아니면 새 지시
async function handleMessage(update) {
  const message = update.message
  const text = message.text?.trim()
  if (!text) return 'no-text'
  const chatId = message.chat?.id
  if (!isOwner(chatId)) return 'not-owner'
  return guard(chatId, () => routeMessage(update, text, chatId))
}

async function routeMessage(update, text, chatId) {
  const message = update.message

  try {
    await sweepStale(chatId)
  } catch (error) {
    console.error('[agents] 남은 작업 정리 실패', error)
  }

  // 운영 명령(/help /pending /cancel)은 AI를 부르지 않고 바로 처리한다
  const command = parseCommand(text)
  if (command) return handleCommand(command, chatId)

  const replyTo = message.reply_to_message?.message_id
  if (replyTo != null) {
    let task = null
    try {
      task = await findAwaitingReason(replyTo)
    } catch (error) {
      console.error('[agents] 반려 작업 조회 실패', error)
    }
    if (task) return handleReason(task, text, chatId)
  }

  return startInstruction({ text, chatId, updateId: update.update_id })
}

// 반려 사유 답장 → "취소"면 종료, 아니면 사유를 feedback에 담아 PLANNING으로 되돌려 재계획
async function handleReason(task, text, chatId) {
  if (text === '취소') {
    const cancelled = await transition(task, 'FAILED', { log: { agent: 'captain', event: 'CANCELLED', note: '반려 후 취소' } })
    if (!cancelled) return 'already'
    await sendMessage(chatId, `🛑 작업을 취소했어요.\n지시: ${task.task_query}`)
    return 'cancelled'
  }
  const planning = await transition(task, 'PLANNING', { log: { agent: 'captain', event: 'REPLANNING', feedback: text }, patch: { feedback: text } })
  if (!planning) return 'already'
  return planAndRoute(planning, chatId)
}

// 버튼 응답. 검사 4개를 모두 통과해야 상태가 바뀐다.
async function handleCallback(callback) {
  const chatId = callback.message?.chat?.id ?? callback.from?.id
  if (!isOwner(chatId)) return 'not-owner'
  return guard(chatId, () => routeCallback(callback, chatId))
}

async function routeCallback(callback, chatId) {
  const messageId = callback.message?.message_id
  const [action, id] = String(callback.data ?? '').split(':')
  const reply = (text) => answerCallbackQuery(callback.id, text)
  const close = (text) => (messageId == null ? null : editMessageText(chatId, messageId, text))

  if ((action !== 'a' && action !== 'r') || !isTaskId(id)) {
    await reply('알 수 없는 버튼이에요')
    return 'bad-data'
  }

  let task
  try {
    task = await getTask(id)
  } catch (error) {
    console.error('[agents] 작업 조회 실패', error)
    await reply('잠시 문제가 생겼어요. 다시 눌러 주세요')
    return 'error'
  }
  if (!task) {
    await reply('작업을 찾을 수 없어요')
    return 'not-found'
  }

  // 검사 1: 아직 결재 대기 상태인가
  if (task.status !== 'PENDING') {
    await reply(`이미 처리된 결재예요 (${task.status})`)
    await close(`${approvalText(task)}\n\n※ 이미 처리됨: ${task.status}`)
    return 'already'
  }

  // 검사 2: 만료 전인가
  if (new Date(task.expires_at).getTime() <= Date.now()) {
    await transition(task, 'FAILED', { log: { agent: 'intake', event: 'EXPIRED', note: '결재 대기 시간(30분) 초과' } }).catch(() => null)
    await reply('만료된 결재예요')
    await close(`⏰ 만료됨: 30분 안에 결정하지 않아 취소되었습니다.\n지시: ${task.task_query}`)
    return 'expired'
  }

  // 검사 3: 결재 요청 때의 계획과 지금 저장된 계획이 같은가
  if (hashPlan(task.plan_payload) !== task.plan_hash) {
    await transition(task, 'FAILED', { log: { agent: 'intake', event: 'HASH_MISMATCH', note: '계획이 승인 요청 이후 바뀜' } }).catch(() => null)
    await reply('계획이 바뀌어 거부했어요')
    await close('🚫 승인이 거부되었습니다: 결재 요청 이후 계획 내용이 바뀌었습니다.')
    return 'hash-mismatch'
  }

  // 마지막: "PENDING일 때만" 조건을 건 업데이트 한 번. 먼저 도착한 요청 하나만 성공한다.
  const approve = action === 'a'
  const rejectCount = (task.reject_count ?? 0) + (approve ? 0 : 1)
  let updated
  try {
    updated = await transition(task, approve ? 'APPROVED' : 'REJECTED', {
      log: approve ? { agent: 'captain', event: 'APPROVED' } : { agent: 'captain', event: 'REJECTED', count: rejectCount },
      patch: approve ? {} : { reject_count: rejectCount },
    })
  } catch (error) {
    console.error('[agents] 상태 전환 실패', error)
    await reply('잠시 문제가 생겼어요. 다시 눌러 주세요')
    return 'error'
  }
  if (!updated) {
    await reply('이미 처리된 결재예요')
    return 'already'
  }

  if (approve) {
    await reply('승인했어요. 실행합니다')
    await close(`✅ 승인됨 — 실행 결과는 아래 메시지로 보내요\n지시: ${task.task_query}`)
    const ran = await guard(chatId, () => runApproved(updated, chatId), { executing: true })
    return ran === 'error' ? 'error' : 'approved'
  }

  // 반려: 한도를 넘으면 종료, 아니면 사유를 답장으로 받는다.
  if (rejectCount > MAX_REJECTS) {
    await transition(updated, 'FAILED', { log: { agent: 'intake', event: 'REJECT_LIMIT', note: `반려 ${rejectCount}회` } })
    await reply('반려 한도를 넘어 작업을 끝냈어요')
    await close(`❌ 반려 ${rejectCount}회째라 작업을 끝냈어요\n지시: ${task.task_query}`)
    return 'reject-limit'
  }
  await reply('반려했어요')
  await close(`❌ 반려됨 (${rejectCount}/${MAX_REJECTS}회)\n지시: ${task.task_query}`)
  const prompt = await sendMessage(chatId, REASON_PROMPT, forceReply('반려 사유 (또는 취소)'))
  if (prompt.messageId != null) {
    await appendLog(updated, { agent: 'intake', event: 'REASON_REQUESTED', prompt_message_id: prompt.messageId }).catch(() => null)
  }
  return 'rejected'
}

// 웹훅이 받은 텔레그램 업데이트 하나를 처리하고, 무슨 일이 있었는지 짧은 이름으로 돌려준다.
export async function handleUpdate(update) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return 'not-configured'
  if (update?.callback_query) return handleCallback(update.callback_query)
  if (update?.message) return handleMessage(update)
  return 'ignored'
}
