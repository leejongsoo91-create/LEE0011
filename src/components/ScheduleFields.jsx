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

// 일정 입력칸: 날짜, 시간(선택), 알림 시점. 시간을 정해야 알림 시점을 고를 수 있다.
export default function ScheduleFields({ values, onChange }) {
  const update = (key, value) => onChange({ ...values, [key]: value })

  return (
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
  )
}
