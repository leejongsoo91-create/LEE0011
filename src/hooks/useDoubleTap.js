import { useRef } from 'react'

// 같은 대상을 짧은 시간(기본 0.35초) 안에 두 번 눌렀는지 알려 주는 함수를 돌려준다.
// 브라우저의 dblclick은 폰(특히 아이폰)에서 잘 오지 않아서, click이 두 번 온 것을 직접 센다.
// 사용: const isDoubleTap = useDoubleTap();  onClick={(e) => isDoubleTap('칸-5', e.timeStamp) && ...}
export default function useDoubleTap(delay = 350) {
  const last = useRef({ key: null, time: 0 })

  return (key, timeStamp) => {
    const isDouble = last.current.key === key && timeStamp - last.current.time <= delay
    last.current = isDouble ? { key: null, time: 0 } : { key, time: timeStamp }
    return isDouble
  }
}
