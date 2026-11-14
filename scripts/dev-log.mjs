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
//   WSL에서 돌 때도 reg.exe(Windows 쪽 프로그램)로 같은 값을 읽는다. 값은 Windows 한 곳에만 둔다.
// 보내는 곳: DEV_LOG_URL (기본 https://lee-0011.vercel.app/api/dev-log)
// 시크릿 값은 화면에 찍지 않는다. 기록 실패는 작업을 막지 않도록 경고만 하고 종료 코드 1.

import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const URL_DEFAULT = 'https://lee-0011.vercel.app/api/dev-log'

// 레지스트리를 읽을 프로그램: Windows는 reg, WSL은 reg.exe, 그 밖(맥·보통 리눅스)은 없음
export function regCommand(platform = process.platform, env = process.env) {
  if (platform === 'win32') return 'reg'
  if (platform === 'linux' && env.WSL_DISTRO_NAME) return 'reg.exe'
  return null
}

// reg query 출력에서 값만 뽑는다 (Windows 줄바꿈 \r\n도 \S+가 걸러 냄)
export const parseRegOutput = (out) => /DEV_LOG_SECRET\s+REG(?:_EXPAND)?_SZ\s+(\S+)/.exec(out)?.[1] ?? ''

export function readSecret({ env = process.env, platform = process.platform, run = execFileSync } = {}) {
  const fromEnv = env.DEV_LOG_SECRET?.trim()
  if (fromEnv) return fromEnv
  const command = regCommand(platform, env)
  if (!command) return ''
  try {
    const out = run(command, ['query', 'HKCU\\Environment', '/v', 'DEV_LOG_SECRET'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5_000 })
    return parseRegOutput(out)
  } catch {
    return ''
  }
}

async function main() {
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
}

// 직접 실행했을 때만 보낸다 (테스트에서 불러올 때는 보내지 않음). 심볼릭 링크로 불러도 실제 경로로 비교
const isMain = () => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}
if (isMain()) await main()
