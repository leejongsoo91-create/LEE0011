#!/usr/bin/env node
// 작업 단위 기록 (보고서 12): 중앙관제 개발 팀 창의 "작업"(왜·무엇을·코드·보고서)을 남긴다.
//
// 쓰는 법 (작업 번호는 한글: 보고서12-1, 보고서 없는 작은 수정은 수정-20261120-1):
//   node scripts/dev-work.mjs start  <작업 번호> "<제목>" [--reason "왜"] [--report <claude.ai 보고서 주소>]
//   node scripts/dev-work.mjs commit <작업 번호> [커밋...]     (기본 HEAD. 바뀐 파일·줄 수·분야·바꾼 내용을 git에서 읽음)
//   node scripts/dev-work.mjs done   <작업 번호>              (배포 확인 통과 뒤)
//   node scripts/dev-work.mjs revert <작업 번호>              (git revert로 되돌렸을 때)
// 시크릿·보내는 곳은 dev-log.mjs와 같다. 기록 실패는 작업을 막지 않도록 경고만 하고 종료 코드 1.

import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { postDevLog, splitWorkArg } from './dev-log.mjs'
import { commitBody, parseGitLog } from './dev-work-lib.mjs'

// --이름 값 꼴 인자를 뽑는다
export function parseOptions(args) {
  const rest = []
  const options = {}
  for (let i = 0; i < args.length; i += 1) {
    const match = /^--(reason|report)$/.exec(args[i])
    if (match) options[match[1]] = args[(i += 1)]
    else rest.push(args[i])
  }
  return { rest, options }
}

// 커밋마다 메시지와 --numstat을 한 번에 읽는다
function readCommits(refs) {
  return refs.flatMap((ref) =>
    parseGitLog(execFileSync('git', ['-c', 'core.quotepath=off', 'show', '--numstat', '--format=%x1e%H%x1f%aI%x1f%B%x1d', ref], { encoding: 'utf8' })),
  )
}

async function main() {
  const { rest, options } = parseOptions(splitWorkArg(process.argv.slice(2)).rest)
  const [command, key, ...more] = rest
  let bodies
  if (command === 'start' && key && more[0]) {
    bodies = [{ type: 'work', work_key: key, title: more[0], status: '진행 중', ...(options.reason ? { reason: options.reason } : {}), ...(options.report ? { report_url: options.report } : {}) }]
  } else if (command === 'commit' && key) {
    // 커밋마다 따로 보낸다 (줄 수를 커밋별로 한 번만 더하게)
    bodies = readCommits(more.length ? more : ['HEAD']).map((commit) => commitBody(key, commit))
  } else if ((command === 'done' || command === 'revert') && key) {
    bodies = [{ type: 'work', work_key: key, status: command === 'done' ? '완료' : '되돌림', finished_at: new Date().toISOString() }]
  } else {
    console.error('쓰는 법: node scripts/dev-work.mjs <start|commit|done|revert> <작업 번호> ... (파일 맨 위 설명 참고)')
    process.exit(2)
  }
  try {
    for (const body of bodies) {
      const text = await postDevLog(body)
      console.log(`[dev-work] ${command} ${key}${body.commits ? ` ${body.commits[0]}` : ''} ${text.slice(0, 80)}`)
    }
  } catch (error) {
    console.error(`[dev-work] ${error.message}`)
    process.exit(1)
  }
}

// 직접 실행했을 때만 보낸다 (테스트에서 불러올 때는 보내지 않음)
const isMain = () => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}
if (isMain()) await main()
