// 일정 시간 칸에 글자로 친 시간을 "HH:MM"으로 읽는다.
// 돌려주는 값: 읽었으면 "14:30", 빈 칸이면 ''(시간 없음 = 종일), 못 읽으면 null.
// 오전·오후를 안 쓰면 적힌 숫자 그대로 24시간제로 본다 (2시 = 02:00). 칸 아래 미리보기로 확인한다.
// "자정"·"밤 12시"는 그날 밤인지 다음 날 0시인지 헷갈려 일부러 못 읽음으로 둔다 (알림이 하루 어긋나지 않게).

// 때를 나타내는 말 → 시(1~12)를 24시간제로 바꾸는 규칙. 못 쓰는 시는 null.
const PERIODS = {
  오전: (h) => (h === 12 ? 0 : h),
  아침: (h) => (h === 12 ? null : h),
  새벽: (h) => (h <= 6 ? h : null),
  오후: (h) => (h === 12 ? 12 : h + 12),
  저녁: (h) => (h >= 5 && h <= 11 ? h + 12 : null),
  // 낮: 9~11시는 오전, 12시는 정오, 1~6시는 오후
  낮: (h) => (h >= 9 && h <= 11 ? h : h === 12 ? 12 : h <= 6 ? h + 12 : null),
  // 밤: 6~11시는 오후, 1~5시는 새벽(밤 1시 = 01:00), 12시는 날짜가 헷갈려 못 읽음
  밤: (h) => (h >= 6 && h <= 11 ? h + 12 : h <= 5 ? h : null),
  am: (h) => (h === 12 ? 0 : h),
  pm: (h) => (h === 12 ? 12 : h + 12),
}

const pad = (n) => String(n).padStart(2, '0')

// 숫자 부분만 남은 글에서 시·분을 읽는다. 못 읽으면 null.
function readClock(body) {
  // "2시", "2시 30분", "2시30", "2시반"
  let m = /^(\d{1,2})\s*시(?:\s*(?:(\d{1,2})\s*분?|반))?$/.exec(body)
  if (m) return { hour: Number(m[1]), minute: body.endsWith('반') ? 30 : m[2] ? Number(m[2]) : 0 }
  // "14:30", "14.30", "9:05"
  m = /^(\d{1,2})[:.](\d{2})$/.exec(body)
  if (m) return { hour: Number(m[1]), minute: Number(m[2]) }
  // 숫자만: "9", "09" → 9시, "930" → 9:30, "1430" → 14:30
  m = /^\d{1,4}$/.exec(body)
  if (m) {
    if (body.length <= 2) return { hour: Number(body), minute: 0 }
    const cut = body.length - 2
    return { hour: Number(body.slice(0, cut)), minute: Number(body.slice(cut)) }
  }
  return null
}

// "자정"·"밤 12시"처럼 일부러 못 읽게 둔 글인지 (안내 문구를 따로 보여 주려고)
export function isAmbiguousMidnight(raw) {
  const text = String(raw ?? '').normalize('NFKC').replace(/\s+/g, '')
  return text === '자정' || /^밤12(시|:00)?$/.test(text)
}

export function parseTimeText(raw) {
  // NFKC: 전각 숫자·콜론(１４：３０)도 보통 글자로
  let text = String(raw ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!text) return ''
  if (text === '정오') return '12:00'

  // 앞의 "오전/오후…" 또는 뒤의 "am/pm"
  let period = Object.keys(PERIODS).find((w) => /[가-힣]/.test(w) && text.startsWith(w)) ?? null
  if (period) {
    text = text.slice(period.length).trim()
  } else {
    const m = /\s*([ap])\.?m\.?$/.exec(text)
    if (m) {
      period = m[1] === 'a' ? 'am' : 'pm'
      text = text.slice(0, m.index).trim()
    }
  }

  const clock = readClock(text)
  if (!clock) return null
  let { hour, minute } = clock
  if (minute > 59) return null
  if (period) {
    // 12시간제: 1~12시만 (오전 0시는 00시로 봐 준다)
    if (period === '오전' && hour === 0) hour = 0
    else if (hour < 1 || hour > 12) return null
    else hour = PERIODS[period](hour)
    if (hour === null) return null
  } else if (hour > 23) {
    return null
  }
  return `${pad(hour)}:${pad(minute)}`
}
