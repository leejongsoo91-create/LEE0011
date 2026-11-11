#!/usr/bin/env node
// 개발 팀 작업 기록 보내기: 업무 탭 "개발 팀" 현황판에 한 줄을 남긴다. (노트북에서 Claude Code가 단계마다 부른다)
//
// 쓰는 법:
//   node scripts/dev-log.mjs <agent> <kind> <status> "<한 줄 요약>" [ref]
//     agent : lead | qa | devops
//     kind  : plan | edit | test | review | commit | deploy | check
//     status: running | pass | fail | info
//     ref   : 커밋 해시 또는 https 주소 (선택)
//   예) node scripts/dev-log.mjs qa review pass "재검토 통과: 커밋해도 됨" d2adaa0
//
// 시크릿: 환경변수 DEV_LOG_SECRET (Vercel과 같은 값). 지금 창에 없으면 Windows 사용자 환경변수(레지스트리)에서 읽는다.
//   setx로 넣은 값은 새로 연 창에만 보이는데, 이미 열려 있는 Claude Code에서도 바로 쓰려고.
// 보내는 곳: DEV_LOG_URL (기본 https://lee-0011.vercel.app/api/dev-log)
// 시크릿 값은 화면에 찍지 않는다. 기록 실패는 작업을 막지 않도록 경고만 하고 종료 코드 1.

import { execFileSync } from 'node:child_process'

const URL_DEFAULT = 'https://lee-0011.vercel.app/api/dev-log'

function readSecret() {
  const fromEnv = process.env.DEV_LOG_SECRET?.trim()
  if (fromEnv) return fromEnv
  if (process.platform !== 'win32') return ''
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', 'DEV_LOG_SECRET'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return /DEV_LOG_SECRET\s+REG(?:_EXPAND)?_SZ\s+(\S+)/.exec(out)?.[1] ?? ''
  } catch {
    return ''
  }
}

const [agent, kind, status, summary, ref] = process.argv.slice(2)
if (!agent || !kind || !status || !summary) {
  console.error('쓰는 법: node scripts/dev-log.mjs <lead|qa|devops> <kind> <running|pass|fail|info> "<요약>" [ref]')
  process.exit(2)
}

const secret = readSecret()
if (!secret) {
  console.error('[dev-log] DEV_LOG_SECRET이 없어 기록하지 않았어요')
  process.exit(1)
}

try {
  const response = await fetch(process.env.DEV_LOG_URL || URL_DEFAULT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-dev-log-secret': secret },
    body: JSON.stringify({ agent, kind, status, summary, ...(ref ? { ref } : {}) }),
    signal: AbortSignal.timeout(10_000),
  })
  const text = await response.text()
  if (!response.ok) {
    console.error(`[dev-log] 기록 실패 ${response.status} ${text.slice(0, 100)}`)
    process.exit(1)
  }
  console.log(`[dev-log] 기록함 ${agent}/${kind}/${status} ${text.slice(0, 80)}`)
} catch (error) {
  console.error(`[dev-log] 보내지 못했어요: ${error?.name ?? 'error'}`)
  process.exit(1)
}
