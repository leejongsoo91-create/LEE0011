import { readStorage, writeStorage } from './storage.js'

const keyOf = (path) => `page-title:${path}`

// 페이지별 제목을 읽는다. 없으면 빈 문자열.
export function loadTitle(path) {
  return readStorage(keyOf(path)) ?? ''
}

// 제목을 임시 저장하고, 빵부스러기가 갱신되도록 알린다.
export function saveTitle(path, title) {
  writeStorage(keyOf(path), title)
  window.dispatchEvent(new Event('titlechange'))
}
