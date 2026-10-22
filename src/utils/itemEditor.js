// 카드 등을 눌렀을 때 Layout의 편집 모달을 열도록 알린다.
export function openItemEditor(table, row) {
  window.dispatchEvent(new CustomEvent('edititem', { detail: { table, row } }))
}

// '+ 새로 만들기' 버튼 등에서 Layout의 새 항목 추가 모달을 열도록 알린다.
// prefill에 { date: '2026-10-23' }처럼 주면 일정 모달의 날짜가 미리 채워진다.
export function openAddModal(prefill = null) {
  window.dispatchEvent(new CustomEvent('additem', { detail: prefill }))
}

// 달력의 일정을 두 번 눌렀을 때 Layout의 일정 보기 모달을 열도록 알린다.
export function openScheduleView(row) {
  window.dispatchEvent(new CustomEvent('viewschedule', { detail: row }))
}

// 달력의 '+N개'를 눌렀을 때 Layout의 하루 일정 목록 모달을 열도록 알린다. (date: 'YYYY-MM-DD')
export function openDayList(date) {
  window.dispatchEvent(new CustomEvent('viewday', { detail: date }))
}
