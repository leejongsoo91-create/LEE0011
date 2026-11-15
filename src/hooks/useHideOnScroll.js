import { useEffect, useState } from 'react'

// 글을 치는 칸으로 볼 입력 종류 (체크박스·버튼 등은 빼고)
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'])

function isTyping(el) {
  if (!el || el === document.body) return false
  if (el.isContentEditable) return true
  if (el.tagName === 'TEXTAREA') return true
  return el.tagName === 'INPUT' && !NON_TEXT_INPUTS.has(el.type)
}

// 떠 있는 버튼(+)을 숨길지 알려 준다.
// - 아래로 스크롤하는 동안 숨기고, 위로 조금만 올려도 다시 보인다 (맨 위 근처에서는 늘 보인다)
// - 글을 치는 동안 숨긴다 (폰 자판 위에 버튼이 뜨지 않게)
export default function useHideOnScroll({ threshold = 8, topZone = 80 } = {}) {
  const [scrolledDown, setScrolledDown] = useState(false)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    let timer = null
    // 입력칸이 통째로 사라지면(모달 닫힘) Safari·Firefox는 focusout을 보내지 않으므로, 스크롤·터치 때도 다시 본다
    const recheckTyping = () => setTyping(isTyping(document.activeElement))
    const onScroll = () => {
      recheckTyping()
      const y = window.scrollY
      if (y < topZone) setScrolledDown(false)
      else if (y - lastY > threshold) setScrolledDown(true)
      else if (lastY - y > threshold) setScrolledDown(false)
      else return // 조금 움직인 것은 무시하고 기준점도 그대로 둔다
      lastY = y
    }
    // focusout 직후에는 activeElement가 아직 body라 다음 틱에 다시 본다
    const onFocus = () => {
      clearTimeout(timer)
      timer = setTimeout(recheckTyping, 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('pointerdown', onFocus)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onFocus)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('pointerdown', onFocus)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onFocus)
    }
  }, [threshold, topZone])

  return scrolledDown || typing
}
