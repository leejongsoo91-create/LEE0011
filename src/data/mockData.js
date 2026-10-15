// Phase 2: 실제 DB 연동 전에 화면 디테일을 잡기 위해 사용하는 정적 Mock 데이터

// 일정
export const scheduleItems = [
  { id: 1, title: '모션빌더 사이클 애니메이션 작업', date: '2026-10-18' },
  { id: 2, title: 'JALI 오디오 기반 표정 애니메이션 테스트', date: '2026-10-20' },
]

// 업무/프로젝트
export const workItems = [
  {
    id: 1,
    title: 'Simple Retargeter UI 세팅 (Object Mode 반영)',
    status: 'In Progress',
    progress: 75,
  },
  {
    id: 2,
    title: '10x10m 광학식 스튜디오 Valkyrie 30대 배치도',
    status: 'Done',
    progress: 100,
  },
  {
    id: 3,
    title: '프랍 수납장 세팅 (1.8m 봉 20개, 1m 검 50개 단일 U자 고리)',
    status: 'Todo',
    progress: 0,
  },
]

// 학습/취미
export const hobbyItems = [
  {
    id: 1,
    title: '2027년 전기기사 1차 필기 대비',
    details: '5개월 20개년 기출문제 풀이',
    date: '2026-10-16',
  },
  {
    id: 2,
    title: '홈 서버 미니 PC 구축',
    details: 'Beelink SER5 MAX Proxmox 설치',
    date: '2026-10-10',
  },
]

// 투자
export const investmentItems = [
  { id: 1, ticker: 'QQQM', name: 'Invesco NASDAQ 100', avgPrice: '$210.50', quantity: 55 },
  { id: 2, ticker: 'SCHD', name: 'Schwab US Dividend Equity', avgPrice: '$82.15', quantity: 120 },
  { id: 3, ticker: 'SCHG', name: 'Schwab US Large-Cap Growth', avgPrice: '$95.00', quantity: 40 },
]
