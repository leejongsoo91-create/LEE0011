// 일정 입력 폼의 값({ date, time, remind })을 만드는 도우미

// 새 일정의 기본값: 날짜(기본은 오늘), 시간 없음, 알림은 정시
export function emptySchedule(date) {
  return { date: date ?? new Date().toLocaleDateString('sv-SE'), time: '', remind: '0' }
}

// 저장된 일정 행을 폼의 값으로 바꾼다. (알림이 없으면 remind는 '알림 없음'을 뜻하는 빈 문자열)
export function scheduleFromRow(row) {
  return {
    date: row.date ?? '',
    time: row.time ? row.time.slice(0, 5) : '',
    remind: row.remind_before_min == null ? '' : String(row.remind_before_min),
  }
}
