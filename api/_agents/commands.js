// 운영 명령: AI를 부르지 않고 바로 처리한다.
//   /help (/start)  사용법, 부서와 지시 예시, 지금 설정된 프로그램
//   /pending        결재 대기·반려 사유 대기·실행 중인 작업 목록. 결재 대기는 버튼을, 사유 대기는 답장 칸을 다시 보낸다
//   /cancel         결재 대기·반려 사유 대기 작업을 모두 취소 (실행 중인 작업은 멈출 수 없어 그대로)

import { matchingSummary, roleConfig } from './agents.config.js'
import { loadSettings } from './settings.js'
import { departments } from './registry.js'
import { REASON_PROMPT, approvalButtons, approvalText, kst } from './report.js'
import { loadRules, rulesStatus } from './rules.js'
import { forceReply, sendMessage } from './telegram.js'
import { appendLog, listOpenTasks, transition } from './tasks.js'

const MAX_RESEND = 5

// "/pending", "/pending@lee0011_bot" → 'pending'. 명령이 아니면 null
export function parseCommand(text) {
  const match = String(text ?? '').match(/^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i)
  return match ? match[1].toLowerCase() : null
}

// settings: 저장된 매칭(settings.js의 loadSettings). 없으면 환경변수 기본값만 보여 준다.
export function helpText(settings = {}) {
  const real = Object.values(departments).filter((dept) => dept.id !== 'test')
  return [
    '🤖 결재 통제형 에이전트 사용법',
    '지시를 그냥 보내면 메인 에이전트가 계획을 세워요. 데이터를 바꾸는 계획은 [승인]을 눌러야 실행돼요. 조회만 하는 계획은 바로 실행해요.',
    '',
    '부서:',
    ...real.flatMap((dept) => [`• ${dept.name} — ${dept.role ?? ''}`, ...(dept.examples?.length ? [`  예) ${dept.examples.join(' / ')}`] : [])]),
    '• 테스트 팀 — 지시에 "실패 테스트"를 붙이면 원복(롤백)을 확인할 수 있어요',
    '',
    '명령:',
    '/pending — 결재·사유 대기 중인 작업 다시 보기',
    '/cancel — 대기 중인 작업 모두 취소',
    '/help — 이 안내',
    '',
    `지금 설정: ${matchingSummary(roleConfig('main', process.env, settings), roleConfig('crosscheck', process.env, settings))}`,
  ].join('\n')
}

const byCreated = (a, b) => String(a.created_at).localeCompare(String(b.created_at))

async function pending(chatId) {
  const rows = (await listOpenTasks()).sort(byCreated)
  if (rows.length === 0) {
    await sendMessage(chatId, '📋 대기 중인 작업이 없어요.')
    return 'pending-none'
  }
  const count = (status) => rows.filter((row) => row.status === status).length
  const lines = [
    `📋 대기 중인 작업 ${rows.length}건`,
    `결재 대기 ${count('PENDING')} · 반려 사유 대기 ${count('REJECTED')} · 실행 중 ${count('EXECUTING')}`,
  ]
  for (const row of rows.filter((r) => r.status === 'EXECUTING')) lines.push(`• 실행 중: ${row.task_query}`)
  const resend = rows.filter((r) => r.status === 'PENDING' || r.status === 'REJECTED')
  if (resend.length > MAX_RESEND) lines.push(`(오래된 것부터 ${MAX_RESEND}건만 다시 보내요)`)
  await sendMessage(chatId, lines.join('\n'))

  const status = rulesStatus(loadRules())
  for (const row of resend.slice(0, MAX_RESEND)) {
    if (row.status === 'PENDING') {
      await sendMessage(chatId, `${approvalText(row, status)}\n\n(다시 보냄 · 처음 요청 ${kst(row.created_at)})`, approvalButtons(row.id))
    } else {
      // 반려 사유 답장 칸을 새로 띄우고, 그 메시지 번호도 기록해 둔다 (예전 칸에 답해도 그대로 동작)
      const prompt = await sendMessage(chatId, `${REASON_PROMPT}\n\n지시: ${row.task_query}`, forceReply('반려 사유 (또는 취소)'))
      if (prompt.messageId != null) {
        await appendLog(row, { agent: 'intake', event: 'REASON_REQUESTED', prompt_message_id: prompt.messageId, via: '/pending' }).catch(() => null)
      }
    }
  }
  return 'pending-listed'
}

async function cancelAll(chatId) {
  const rows = (await listOpenTasks()).sort(byCreated)
  const cancelled = []
  for (const row of rows.filter((r) => r.status === 'PENDING' || r.status === 'REJECTED')) {
    const done = await transition(row, 'FAILED', { log: { agent: 'captain', event: 'CANCELLED', note: '/cancel' } })
    if (done) cancelled.push(row)
  }
  const executing = rows.filter((r) => r.status === 'EXECUTING').length
  const lines = [cancelled.length ? `🛑 대기 중이던 작업 ${cancelled.length}건을 취소했어요.` : '취소할 대기 작업이 없어요.']
  for (const row of cancelled) lines.push(`• ${row.task_query}`)
  if (executing) lines.push(`실행 중인 작업 ${executing}건은 멈출 수 없어 그대로 두었어요.`)
  await sendMessage(chatId, lines.join('\n'))
  return 'cancelled-all'
}

export async function handleCommand(command, chatId) {
  if (command === 'help' || command === 'start') {
    await sendMessage(chatId, helpText(await loadSettings()))
    return 'help'
  }
  if (command === 'pending') return pending(chatId)
  if (command === 'cancel') return cancelAll(chatId)
  await sendMessage(chatId, `모르는 명령이에요: /${command}\n\n${helpText(await loadSettings())}`)
  return 'unknown-command'
}
