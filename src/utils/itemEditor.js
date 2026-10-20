// 카드 등을 눌렀을 때 Layout의 편집 모달을 열도록 알린다.
export function openItemEditor(table, row) {
  window.dispatchEvent(new CustomEvent('edititem', { detail: { table, row } }))
}

// '+ 새로 만들기' 버튼 등에서 Layout의 새 항목 추가 모달을 열도록 알린다.
export function openAddModal() {
  window.dispatchEvent(new Event('additem'))
}
