const weekdays = ['월', '화', '수', '목', '금', '토', '일']

// 이번 달 1일 앞의 빈 칸(월요일 시작 기준)과 날짜 목록을 만든다.
function buildCells(year, month) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const lastDate = new Date(year, month + 1, 0).getDate()
  const blanks = Array.from({ length: offset }, () => null)
  const dates = Array.from({ length: lastDate }, (_, index) => index + 1)
  return [...blanks, ...dates]
}

// 월간 달력 그리드 뼈대 (요일 헤더 + 날짜 카드)
export default function CalendarGrid() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const cells = buildCells(year, month)

  return (
    <section aria-label="월간 달력" className="mx-auto max-w-4xl pb-8">
      <h2 className="mb-4 text-xl font-bold text-gray-100">
        {year}년 {month + 1}월
      </h2>
      <div className="grid grid-cols-7 gap-1 lg:gap-2">
        {weekdays.map((day) => (
          <div key={day} className="py-2 text-center text-xs font-medium text-gray-500">
            {day}
          </div>
        ))}
        {cells.map((date, index) =>
          date === null ? (
            <div key={`blank-${index}`} aria-hidden="true" />
          ) : (
            <div
              key={date}
              className={`min-h-16 rounded-lg border bg-gray-800 p-1.5 text-xs text-gray-300 lg:min-h-24 lg:p-2 lg:text-sm ${
                date === today.getDate() ? 'border-gray-400 text-white' : 'border-gray-700'
              }`}
            >
              {date}
            </div>
          ),
        )}
      </div>
    </section>
  )
}
