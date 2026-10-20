// localStorage를 안전하게 읽고 쓰는 도우미 (접근이 막혀 있어도 오류 없이 동작한다)
export function readStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 저장할 수 없는 환경이면 조용히 건너뛴다.
  }
}
