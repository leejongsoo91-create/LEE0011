// 페이지별 제목을 메모리에만 들고 있다. (새로고침하면 사라지고, 저장은 모달/Supabase가 맡는다.)
const titles = new Map()

export function loadTitle(path) {
  return titles.get(path) ?? ''
}

// 제목을 기억하고, 빵부스러기가 갱신되도록 알린다.
export function saveTitle(path, title) {
  titles.set(path, title)
  window.dispatchEvent(new Event('titlechange'))
}
