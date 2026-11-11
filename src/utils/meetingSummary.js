// 회의 기록(Plaud 요약 Markdown)을 화면에 그릴 블록으로 바꾼다. HTML을 만들지 않고 글자만 다룬다.
// 쓰는 문법만 다룬다: # 제목, - [ ] 할 일, - 목록, > 인용, 나머지는 문단.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const plain = (text) => text.replace(/\*\*|__|`/g, '').trim()

export function summaryBlocks(markdown) {
  const blocks = []
  for (const raw of String(markdown ?? '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    let m
    if ((m = /^(#{1,6})\s+(.+)$/.exec(line))) blocks.push({ type: 'heading', level: Math.min(m[1].length, 3), text: plain(m[2]) })
    else if ((m = /^[-*]\s+\[([ xX])\]\s+(.+)$/.exec(line))) blocks.push({ type: 'todo', done: m[1] !== ' ', text: plain(m[2]) })
    else if ((m = /^[-*]\s+(.+)$/.exec(line))) blocks.push({ type: 'item', text: plain(m[1]) })
    else if ((m = /^>\s?(.*)$/.exec(line))) {
      const text = plain(m[1])
      if (text) blocks.push({ type: 'quote', text })
    } else blocks.push({ type: 'text', text: plain(line) })
  }
  return blocks
}

// ISO 시각 → "11/12(목) 17:42" (한국 시간). 없으면 빈 문자열
export function meetingTime(iso) {
  const ms = Date.parse(iso ?? '')
  if (Number.isNaN(ms)) return ''
  const kst = new Date(ms + 9 * 60 * 60 * 1000)
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}(${WEEKDAYS[kst.getUTCDay()]}) ${kst.toISOString().slice(11, 16)}`
}

// 마감일 "2026-11-15" → "11/15 마감". 없으면 빈 문자열
export const dueLabel = (date) => (/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} 마감` : '')
