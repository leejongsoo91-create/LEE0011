// 일정 입력 폼의 값({ date, time, remind, agentTask, agentBefore })을 만드는 도우미
// agentTask: 일정 시각에 에이전트가 할 일(빈 문자열 = 자동 작업 없음), agentBefore: 몇 분 전에 시작할지

// 새 일정의 기본값: 날짜(기본은 오늘), 시간 없음, 알림은 정시
export function emptySchedule(date) {
  return { date: date ?? new Date().toLocaleDateString('sv-SE'), time: '', remind: '0', agentTask: '', agentBefore: '10' }
}

// 저장된 일정 행을 폼의 값으로 바꾼다. (알림이 없으면 remind는 '알림 없음'을 뜻하는 빈 문자열)
export function scheduleFromRow(row) {
  return {
    date: row.date ?? '',
    time: row.time ? row.time.slice(0, 5) : '',
    remind: row.remind_before_min == null ? '' : String(row.remind_before_min),
    agentTask: row.agent_task ?? '',
    agentBefore: String(row.agent_before_min ?? 10),
  }
}

export const AGENT_TASK_MAX = 300

// 저장할 에이전트 작업 칸 값. 시간이 없거나(종일) 내용이 비어 있으면 자동 작업 없음(null).
export function agentColumns(schedule) {
  const text = (schedule.agentTask ?? '').trim().slice(0, AGENT_TASK_MAX)
  return {
    agent_task: schedule.time && text ? text : null,
    agent_before_min: Number(schedule.agentBefore ?? 10),
  }
}
