// 업무 부서 도구: work.import_meeting(write, 원복 = 만든 할 일 카드와 회의 기록 삭제)
// 규칙서: depts/work/rules.md. 모든 쿼리에 주인 user_id 조건을 코드가 강제로 붙인다.
// 이 도구는 Plaud 자동 수신(plaudTrigger.js)이 코드로 만든 계획에서만 쓴다. AI 메인 에이전트에게는 보이지 않는다.

import { ownerUserId } from '../../owner.js'
import { MAX_ASSIGNEE, MAX_SUMMARY, MAX_TITLE, MAX_TODOS, PLAUD_KEY, validDate, whenLabel } from '../../plaud.js'
import { rest } from '../../supabase.js'

const SHOWN_TODOS = 10

function onlyKeys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '인자가 객체가 아닙니다'
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  return unknown.length ? `모르는 인자: ${unknown.join(', ')}` : null
}

const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max

function checkTodo(todo, n) {
  const keys = onlyKeys(todo, ['title', 'assignee', 'due_date'])
  if (keys) return `할 일 ${n}: ${keys}`
  if (!text(todo.title, MAX_TITLE)) return `할 일 ${n}: 제목은 1~${MAX_TITLE}자여야 합니다`
  if (todo.assignee != null && !text(todo.assignee, MAX_ASSIGNEE)) return `할 일 ${n}: 담당자는 1~${MAX_ASSIGNEE}자 또는 null이어야 합니다`
  if (todo.due_date != null && !validDate(todo.due_date)) return `할 일 ${n}: 마감일은 실제 있는 날짜(YYYY-MM-DD) 또는 null이어야 합니다`
  return null
}

const todoLine = (todo) => {
  const meta = [todo.assignee, todo.due_date ? todo.due_date.slice(5).replace('-', '/') : null].filter(Boolean)
  return `   - ${todo.title}${meta.length ? ` (${meta.join(', ')})` : ''}`
}

export const workImportMeeting = {
  label: '회의 기록 등록',
  risk: 'write',
  aiVisible: false,
  description: 'Plaud 회의 녹음의 요약을 회의 기록 1건으로, 요약 속 할 일을 칸반 "할 일" 카드로 등록한다.',
  check(args) {
    const keys = onlyKeys(args, ['plaud_key', 'title', 'recorded_at', 'summary_md', 'todos', 'skipped'])
    if (keys) return keys
    if (typeof args.plaud_key !== 'string' || !PLAUD_KEY.test(args.plaud_key)) return 'plaud_key 형식이 잘못되었습니다'
    if (!text(args.title, MAX_TITLE)) return `title은 1~${MAX_TITLE}자여야 합니다`
    if (args.recorded_at !== null && (typeof args.recorded_at !== 'string' || Number.isNaN(Date.parse(args.recorded_at)))) {
      return 'recorded_at은 날짜·시각 문자열 또는 null이어야 합니다'
    }
    if (typeof args.summary_md !== 'string' || args.summary_md.length > MAX_SUMMARY) return `summary_md는 ${MAX_SUMMARY}자 이하 문자열이어야 합니다`
    if (!Array.isArray(args.todos) || args.todos.length > MAX_TODOS) return `todos는 최대 ${MAX_TODOS}개 목록이어야 합니다`
    if (!Number.isInteger(args.skipped) || args.skipped < 0) return 'skipped는 0 이상의 정수여야 합니다'
    for (const [index, todo] of args.todos.entries()) {
      const error = checkTodo(todo, index + 1)
      if (error) return error
    }
    return null
  },
  describe(args) {
    const head = `"${args.title}" (${whenLabel(args.recorded_at)}) · 할 일 카드 ${args.todos.length}장`
    const lines = args.todos.slice(0, SHOWN_TODOS).map(todoLine)
    const more = args.todos.length > SHOWN_TODOS ? [`   …외 ${args.todos.length - SHOWN_TODOS}개`] : []
    const skipped = args.skipped ? [`   (할 일이 많아 ${args.skipped}개는 카드로 만들지 않고 회의 기록에만 남겨요)`] : []
    return [head, ...lines, ...more, ...skipped].join('\n')
  },
  async run(args) {
    const userId = await ownerUserId()
    const rows = await rest('work_meetings', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        user_id: userId,
        plaud_key: args.plaud_key,
        title: args.title,
        recorded_at: args.recorded_at,
        summary_md: args.summary_md,
        todo_count: args.todos.length,
      },
    })
    const meetingId = rows?.[0]?.id
    if (!meetingId) throw new Error('회의 기록 등록 결과를 받지 못했습니다')

    let cardIds = []
    if (args.todos.length) {
      try {
        const cards = await rest('work', {
          method: 'POST',
          prefer: 'return=representation',
          body: args.todos.map((todo) => ({
            user_id: userId,
            title: todo.title,
            status: 'Todo',
            progress: 0,
            meeting_id: meetingId,
            assignee: todo.assignee,
            due_date: todo.due_date,
          })),
        })
        cardIds = (cards ?? []).map((card) => card.id)
      } catch (error) {
        // 카드가 실패하면 방금 만든 회의 기록도 지워 반쯤 들어간 상태를 남기지 않는다.
        // (카드 요청이 서버에 닿았을 수도 있으니 이 회의에 붙은 카드도 함께 지운다)
        await removeMeeting(userId, meetingId).catch((cleanupError) => console.error('[work] 회의 기록 정리 실패', cleanupError))
        throw error
      }
    }
    return {
      meetingId,
      cardIds,
      summary: `회의 기록 1건 + 할 일 카드 ${cardIds.length}장 등록: "${args.title}"`,
    }
  },
  // 원복: 이 회의에 붙은 카드와 회의 기록만, 주인 user_id 조건을 붙여 삭제한다.
  async undo(args, output) {
    if (!output?.meetingId) throw new Error('지울 회의 기록 id가 없습니다')
    const userId = await ownerUserId()
    const { cards, meetings } = await removeMeeting(userId, output.meetingId)
    return { summary: meetings ? `회의 기록 삭제 + 카드 ${cards}장 삭제: "${args.title}"` : '이미 지워진 회의 기록' }
  },
}

async function removeMeeting(userId, meetingId) {
  const cards = await rest(`work?meeting_id=eq.${meetingId}&user_id=eq.${userId}`, { method: 'DELETE', prefer: 'return=representation' })
  const meetings = await rest(`work_meetings?id=eq.${meetingId}&user_id=eq.${userId}`, { method: 'DELETE', prefer: 'return=representation' })
  return { cards: cards?.length ?? 0, meetings: meetings?.length ?? 0 }
}
