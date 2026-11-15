import { useEffect, useLayoutEffect, useRef } from 'react'

// field-sizing: content를 아는 브라우저는 CSS만으로 높이가 맞는다. 모르는 브라우저(일부 Safari)만 JS로 맞춘다.
const cssFits = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content')

// 줄바꿈을 한 줄 값으로: 앞뒤 줄바꿈은 지우고, 가운데 줄바꿈은 빈칸으로
const oneLine = (text) => text.replace(/^[\r\n]+|[\r\n]+$/g, '').replace(/[\r\n]+/g, ' ')

// 값을 코드로 바꾼 뒤(예: 저장 실패로 되돌림) 높이를 다시 맞출 때 부른다
export function fitTextarea(el) {
  if (!el || cssFits) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// 한 줄 값(제목·할 일)을 넣는 칸인데, 글이 길면 줄을 바꿔 끝까지 보여 준다.
// - Enter(폰 자판의 "완료" 포함)는 줄바꿈 대신 입력을 끝낸다(칸을 벗어남).
// - 붙여넣은 줄바꿈은 빈칸으로 바꾼다. 커서 위치는 그대로 둔다.
// - 나머지 속성(defaultValue, value, onChange, onBlur, className 등)은 <textarea>에 그대로 넘긴다.
export default function AutoTextarea({ onChange, className = '', ...props }) {
  const ref = useRef(null)

  // 처음 그릴 때와 값이 바뀔 때 높이를 맞춘다
  useLayoutEffect(() => fitTextarea(ref.current), [props.value])

  useEffect(() => {
    const el = ref.current
    // 줄바꿈 입력을 막고 입력을 끝낸다. keydown 대신 beforeinput을 쓰는 이유:
    // 폰 자판은 한글 조합 중 Enter를 keydown으로 알려 주지 않지만(keyCode 229) beforeinput은 보낸다.
    const onBeforeInput = (event) => {
      if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
        event.preventDefault()
        el.blur()
      }
    }
    el.addEventListener('beforeinput', onBeforeInput)
    // 칸 폭이 바뀌면(창 크기, 글꼴 로드) 높이를 다시 맞춘다
    const observer = !cssFits && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fitTextarea(el)) : null
    observer?.observe(el)
    return () => {
      el.removeEventListener('beforeinput', onBeforeInput)
      observer?.disconnect()
    }
  }, [])

  return (
    <textarea
      ref={ref}
      rows={1}
      aria-multiline="false"
      {...props}
      onChange={(event) => {
        const el = event.target
        if (/[\r\n]/.test(el.value)) {
          // 커서 앞부분은 맨 앞 줄바꿈만 지우고 나머지는 빈칸으로 바꿔 새 커서 위치를 구한다
          const before = el.value.slice(0, el.selectionStart).replace(/^[\r\n]+/, '').replace(/[\r\n]+/g, ' ')
          el.value = oneLine(el.value)
          const caret = Math.min(before.length, el.value.length)
          el.setSelectionRange(caret, caret)
        }
        fitTextarea(el)
        onChange?.(event)
        // 폰 자판이 한글 조합 중이라 beforeinput을 막지 못해 Enter 줄바꿈이 들어온 경우에도 입력을 끝낸다
        const type = event.nativeEvent?.inputType
        if (type === 'insertLineBreak' || type === 'insertParagraph') el.blur()
      }}
      className={`block resize-none overflow-hidden [field-sizing:content] ${className}`}
    />
  )
}
