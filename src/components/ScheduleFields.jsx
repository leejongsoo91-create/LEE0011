import { Bot } from 'lucide-react'
import { AGENT_TASK_MAX } from '../utils/scheduleForm.js'

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
export default function ScheduleFields({ values, onChange }) {
  const update = (key, value) => onChange({ ...values, [key]: value })

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="일정 정보" className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          날짜
          <input type="date" value={values.date} onChange={(event) => update('date', event.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          시간 (선택)
          <input type="time" value={values.time} onChange={(event) => update('time', event.target.value)} className={inputClass} />
        </label>
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
