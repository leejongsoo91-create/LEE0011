// 결재 처리: 텔레그램 업데이트를 받아 (1) 새 지시를 결재 대기 작업으로 만들고 (2) [승인]/[반려] 버튼 응답을 처리한다.
// 1b 단계에서는 "결재 테스트 모드"라서 계획은 가짜이고, 승인되어도 APPROVED에서 멈춘다. (실행은 2단계)

import { buildTestPlan, describePlan, hashPlan } from './plan.js'
import { answerCallbackQuery, editMessageText, sendMessage } from './telegram.js'
import { createTask, getTask, isTaskId, transition } from './tasks.js'

export const APPROVAL_TTL_MS = 30 * 60 * 1000
const MAX_QUERY_SHOWN = 300

const isOwner = (chatId) => {
  const owner = process.env.TELEGRAM_CHAT_ID
  return Boolean(owner) && chatId != null && String(chatId) === String(owner)
}

const kst = (iso) =>
  new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })

function approvalText(task) {
  const query = task.task_query.length > MAX_QUERY_SHOWN ? `${task.task_query.slice(0, MAX_QUERY_SHOWN)}…` : task.task_query
  return [
    '📝 [결재 요청]',
    `지시: ${query}`,
    '',
    '계획:',
    describePlan(task.plan_payload),
    '',
    `⏰ ${kst(task.expires_at)}까지 결정해 주세요 (30분 뒤 만료)`,
    '🧪 테스트 모드: 가짜 계획이라 승인해도 실제로 실행되는 것은 없습니다.',
  ].join('\n')
}

const approvalButtons = (id) => ({
  inline_keyboard: [[{ text: '✅ 승인', callback_data: `a:${id}` }, { text: '❌ 반려', callback_data: `r:${id}` }]],
})

// 새 지시 → 결재 대기 작업 만들기 + 결재 메시지 보내기
async function handleInstruction(update) {
  const message = update.message
  const text = message.text?.trim()
  if (!text) return 'no-text'
  const chatId = message.chat?.id
  if (!isOwner(chatId)) return 'not-owner'

  const plan = buildTestPlan(text)
  let task
  try {
    task = await createTask({
      query: text,
      sourceUpdateId: update.update_id,
      status: 'PENDING',
      plan,
      planHash: hashPlan(plan),
      expiresAt: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
      log: { event: 'CREATED', note: '결재 테스트 모드: 가짜 계획으로 결재 대기' },
    })
  } catch (error) {
    console.error('[agents] 작업 생성 실패', error)
    await sendMessage(chatId, '⚠️ 작업을 저장하지 못했어요. 잠시 뒤에 다시 보내 주세요.')
    return 'error'
  }
  if (!task) return 'duplicate'

  const sent = await sendMessage(chatId, approvalText(task), approvalButtons(task.id))
  if (!sent.ok) {
    // 버튼이 없는 결재 대기 작업이 남지 않도록 닫는다.
    await transition(task, 'FAILED', { log: { event: 'SEND_FAILED', note: '결재 메시지를 보내지 못함' } }).catch(() => null)
    return 'error'
  }
  return 'created'
}

// 버튼 응답 처리. 검사 4개를 모두 통과해야 상태가 바뀐다.
async function handleCallback(callback) {
  const chatId = callback.message?.chat?.id ?? callback.from?.id
  if (!isOwner(chatId)) return 'not-owner'

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
    await transition(task, 'FAILED', { log: { event: 'EXPIRED', note: '결재 대기 시간(30분) 초과' } }).catch(() => null)
    await reply('만료된 결재예요')
    await close(`⏰ 만료됨: 30분 안에 결정하지 않아 취소되었습니다.\n지시: ${task.task_query}`)
    return 'expired'
  }

  // 검사 3: 승인할 때 본 계획과 지금 저장된 계획이 같은가
  if (hashPlan(task.plan_payload) !== task.plan_hash) {
    await transition(task, 'FAILED', { log: { event: 'HASH_MISMATCH', note: '계획이 승인 요청 이후 바뀜' } }).catch(() => null)
    await reply('계획이 바뀌어 거부했어요')
    await close('🚫 승인이 거부되었습니다: 결재 요청 이후 계획 내용이 바뀌었습니다.')
    return 'hash-mismatch'
  }

  // 마지막: "PENDING일 때만"이라는 조건을 건 업데이트 한 번. 먼저 도착한 요청 하나만 성공한다.
  const approve = action === 'a'
  let updated
  try {
    updated = await transition(task, approve ? 'APPROVED' : 'REJECTED', {
      log: { event: approve ? 'APPROVED' : 'REJECTED' },
      patch: approve ? {} : { reject_count: (task.reject_count ?? 0) + 1 },
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
    await reply('승인했어요')
    await close(`✅ 승인됨\n지시: ${task.task_query}\n(테스트 모드: 실행 단계는 아직 연결되지 않았습니다.)`)
    return 'approved'
  }
  await reply('반려했어요')
  await close(`❌ 반려됨\n지시: ${task.task_query}`)
  return 'rejected'
}

// 웹훅이 받은 텔레그램 업데이트 하나를 처리하고, 무슨 일이 있었는지 짧은 이름으로 돌려준다.
export async function handleUpdate(update) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return 'not-configured'
  if (update?.callback_query) return handleCallback(update.callback_query)
  if (update?.message) return handleInstruction(update)
  return 'ignored'
}
