import { useId } from 'react'
import { Bot } from 'lucide-react'
import { AGENT_TASK_MAX } from '../utils/scheduleForm.js'
import { parseTimeText, isAmbiguousMidnight } from '../utils/timeInput.js'
import { formatKoreanTime } from '../utils/dateFormat.js'

const inputClass =
  'rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:border-gray-500 disabled:cursor-not-allowed disabled:opacity-50'

// 알림 시점 선택지 (값은 '몇 분 전'이고, 빈 값은 알림 없음)
const reminderOptions = [
  { value: '0', label: '정시에' },
  { value: '10', label: '10분 전' },
  { value: '30', label: '30분 전' },
  { value: '60', label: '1시간 전' },
  { value: '', label: '알림 없음' },
]

// 에이전트 작업 시작 시점 (일정 몇 분 전에 에이전트가 계획을 세워 결재를 요청할지)
const agentBeforeOptions = [
  { value: '0', label: '정시에' },
  { value: '10', label: '10분 전' },
  { value: '30', label: '30분 전' },
  { value: '60', label: '1시간 전' },
]

// 일정 입력칸: 날짜, 시간(선택), 알림 시점, 에이전트 작업. 시간을 정해야 알림 시점과 에이전트 작업을 쓸 수 있다.
// 시간은 시계 선택기 대신 글자로 친다 (14:30, 1430, 오후 2시 등). 읽은 시각은 칸 아래에 바로 보여 준다.
export default function ScheduleFields({ values, onChange }) {
  const update = (key, value) => onChange({ ...values, [key]: value })
  const hintId = useId()
  // 친 글을 바로 읽어 저장할 시각(time)과 못 읽음 표시(timeInvalid)를 함께 바꾼다
  const updateTime = (text) => {
    const parsed = parseTimeText(text)
    onChange({ ...values, timeText: text, time: parsed ?? '', timeInvalid: parsed === null })
  }
  // 칸에서 나가면 읽은 시각을 "14:30" 모양으로 정리한다 (못 읽은 글은 고칠 수 있게 그대로 둔다)
  const tidyTime = () => {
    if (!values.timeInvalid && values.time !== values.timeText) onChange({ ...values, timeText: values.time })
  }
  const timeHint = values.timeInvalid
    ? isAmbiguousMidnight(values.timeText)
      ? '날짜가 헷갈려요: 23:59로 적거나 다음 날 0:00으로 넣어 주세요'
      : '시간을 읽지 못했어요 (예: 14:30, 오후 2시)'
    : values.time && values.timeText !== values.time
      ? `→ ${formatKoreanTime(values.time)}`
      : ''

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="일정 정보" className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          날짜
          <input type="date" value={values.date} onChange={(event) => update('date', event.target.value)} className={inputClass} />
        </label>
        {/* 안내 문구는 label 밖에 둔다 (입력칸 이름에 섞이지 않고 aria-describedby로만 읽히게).
            묶음 폭을 입력칸과 같게 고정해, 긴 안내가 떠도 칸이 아랫줄로 밀리지 않고 안내만 줄을 바꾼다 */}
        <div className="flex w-36 flex-col gap-1">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            시간 (선택)
            <input
              type="text"
              value={values.timeText}
              onChange={(event) => updateTime(event.target.value)}
              onBlur={tidyTime}
              placeholder="예: 14:30, 오후 2시"
              autoComplete="off"
              enterKeyHint="done"
              maxLength={20}
              aria-invalid={values.timeInvalid || undefined}
              aria-describedby={hintId}
              className={`${inputClass} w-36 ${values.timeInvalid ? 'border-red-500 focus:border-red-500' : ''}`}
            />
          </label>
          <span id={hintId} aria-live="polite" className={`min-h-4 text-xs ${values.timeInvalid ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
            {timeHint}
          </span>
        </div>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          알림
          <select
            value={values.remind}
            disabled={!values.time}
            onChange={(event) => update('remind', event.target.value)}
            className={inputClass}
          >
            {reminderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section aria-label="에이전트 작업" className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            에이전트 작업 (선택)
          </span>
          <textarea
            value={values.agentTask}
            disabled={!values.time}
            maxLength={AGENT_TASK_MAX}
            rows={2}
            placeholder={values.time ? '예: 다음 주 일정 정리해서 보여줘' : '시간을 정해야 쓸 수 있어요'}
            onChange={(event) => update('agentTask', event.target.value)}
            className={`${inputClass} resize-none`}
          />
        </label>
        {values.time && values.agentTask.trim() && (
          <label className="flex items-center gap-2 text-xs text-gray-400">
            시작
            <select value={values.agentBefore} onChange={(event) => update('agentBefore', event.target.value)} className={inputClass}>
              {agentBeforeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span>텔레그램으로 결재 요청이 와요</span>
          </label>
        )}
      </section>
    </div>
  )
}
