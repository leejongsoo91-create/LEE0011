#!/usr/bin/env node
// 개발 팀 작업 기록 보내기: 업무 탭 "개발 팀" 현황판에 한 줄을 남긴다. (노트북에서 Claude Code가 단계마다 부른다)
//
// 쓰는 법:
//   node scripts/dev-log.mjs <agent> <kind> <status> "<한 줄 요약>" [ref] [--work 보고서12-1]
//     agent : lead(개발) | review(검토) | qa(테스트) | devops(운영)
//     kind  : plan | edit | test | review | commit | deploy | check
//     status: running | pass | fail | info
//     ref   : 커밋 해시 또는 https 주소 (선택)
//     --work: 작업 번호 (선택, 보고서 12). 같은 작업의 기록을 중앙관제 작업 창에서 묶어 보여 준다
//     --project: 대시보드(기본) | 주식 (선택, 보고서 13. 주식 사이트 작업을 남길 때)
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

// 인자에서 --work·--project 값을 뺀 나머지와 작업 번호·프로젝트
export function splitWorkArg(args) {
  const rest = []
  let work = null
  let project = null
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--work') work = args[(i += 1)] ?? null
    else if (args[i] === '--project') project = args[(i += 1)] ?? null
    else rest.push(args[i])
  }
  return { rest, work, project }
}

// 기록 입구로 보낸다. 성공하면 응답 글, 실패하면 Error (메시지에 상태 코드와 응답 앞부분, 시크릿은 넣지 않음)
// dev-work.mjs도 같은 입구·시크릿을 쓴다.
export async function postDevLog(body, { secret = readSecret(), url = process.env.DEV_LOG_URL || URL_DEFAULT } = {}) {
  if (!secret) throw new Error('DEV_LOG_SECRET이 없어 기록하지 않았어요')
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-log-secret': secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new Error(`보내지 못했어요: ${error?.name ?? 'error'}`)
  }
  const text = await response.text()
  if (!response.ok) throw new Error(`기록 실패 ${response.status} ${text.slice(0, 100)}`)
  return text
}

async function main() {
  const { rest, work, project } = splitWorkArg(process.argv.slice(2))
  const [agent, kind, status, summary, ref] = rest
  if (!agent || !kind || !status || !summary) {
    console.error('쓰는 법: node scripts/dev-log.mjs <lead|review|qa|devops> <kind> <running|pass|fail|info> "<요약>" [ref] [--work 보고서12-1] [--project 주식]')
    process.exit(2)
  }
  try {
    const text = await postDevLog({ agent, kind, status, summary, ...(ref ? { ref } : {}), ...(work ? { work } : {}), ...(project ? { project } : {}) })
    console.log(`[dev-log] 기록함 ${agent}/${kind}/${status}${work ? ` (${work})` : ''} ${text.slice(0, 80)}`)
  } catch (error) {
    console.error(`[dev-log] ${error.message}`)
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
