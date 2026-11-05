import { Bot, Briefcase, CalendarDays, TrendingUp } from 'lucide-react'
import { addDays, kstDate, kstTime } from './controlTime.js'

// 중앙관제 영역 카드 4개의 숫자를 만든다. (화면 설계 표의 기준)
//   summary: useControlSummary() 결과, work·schedule·investments: useRows() 결과
export function buildControlCards({ summary, work, schedule, investments }, now = new Date()) {
  const agent = summary.data

  // 업무
  const working = work.rows.filter((row) => row.status === 'In Progress')
  const todo = work.rows.filter((row) => row.status === 'Todo').length
  const done = work.rows.filter((row) => row.status === 'Done').length

  // 일정 (한국 시간 기준)
  const today = kstDate(now)
  const nowTime = kstTime(now)
  const weekEnd = addDays(today, 7)
  const todays = schedule.rows.filter((row) => row.date === today)
  const upcoming = schedule.rows.filter((row) => row.date > today && row.date <= weekEnd)
  const passedToday = todays.filter((row) => row.time && row.time < nowTime).length
  const next = [...todays.filter((row) => !row.time || row.time >= nowTime), ...upcoming].sort((a, b) =>
    `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`),
  )[0]
  const nextText = next
    ? ['다음:', next.date === today ? '' : next.date.slice(5), next.time ?? '', next.title || '제목 없음'].filter(Boolean).join(' ')
    : ''

  return [
    {
      title: '에이전트',
      icon: Bot,
      isLoading: summary.isLoading,
      main: { value: agent?.agent.running ?? '—', label: '진행 중' },
      sub: agent ? `결재 대기 ${agent.agent.waiting} · 오늘 완료 ${agent.agent.doneToday}` : '요약 없음',
      items: '일정 · 투자 · 에이전트 설정',
      attention: agent?.agent.attention,
    },
    {
      title: '업무',
      icon: Briefcase,
      to: '/work',
      isLoading: work.isLoading,
      main: { value: working.length, label: '진행 중' },
      sub: `할 일 ${todo} · 완료 ${done}`,
      items: working.slice(0, 2).map((row) => row.title || '제목 없음').join(' · '),
      attention: 0,
    },
    {
      title: '일정',
      icon: CalendarDays,
      to: '/schedule',
      isLoading: schedule.isLoading,
      main: { value: todays.length, label: '오늘' },
      sub: `7일 안 ${upcoming.length} · 오늘 지난 ${passedToday}`,
      items: nextText,
      attention: agent ? agent.schedule.waiting + agent.schedule.attention : undefined,
    },
    {
      title: '투자',
      icon: TrendingUp,
      to: '/investments',
      isLoading: investments.isLoading,
      main: { value: investments.rows.length, label: '보유 종목' },
      sub: `오늘 조회 ${agent?.invest.lookupsToday ?? '—'}`,
      items: investments.rows.slice(0, 3).map((row) => row.name || row.ticker).join(' · '),
      attention: agent?.invest.failedToday,
    },
  ]
}
