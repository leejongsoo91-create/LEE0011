#!/usr/bin/env node
// 지난 커밋을 작업 단위로 옮기기 (보고서 12, 한 번만). 기본은 미리보기만 찍고 아무것도 보내지 않는다.
//   node scripts/dev-work-backfill.mjs            → 미리보기 표 (작업 번호 · 날짜 · 커밋 수 · 파일 수 · 분야 · 제목)
//   node scripts/dev-work-backfill.mjs --apply    → 사용자가 미리보기를 승인한 뒤에만. 같은 작업 번호는 서버가 합치므로 두 번 돌려도 늘지 않는다
// 묶는 기준은 dev-work-lib.mjs의 groupCommits (작업: 줄 → 보고서 번호 → 수정-날짜-순번).

import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { postDevLog } from './dev-log.mjs'
import { groupCommits, parseGitLog } from './dev-work-lib.mjs'

export function previewLines(groups) {
  return groups.map(({ work_key, requests }) => {
    const head = requests[0]
    const files = new Set(requests.flatMap((request) => request.files.map((file) => file.path)))
    return [work_key, head.started_at.slice(0, 10), `커밋 ${requests.length}`, `파일 ${files.size}`, head.areas.join('·') || '-', head.status, head.title].join(' | ')
  })
}

async function main() {
  const log = execFileSync('git', ['-c', 'core.quotepath=off', 'log', '--reverse', '--no-merges', '--numstat', '--format=%x1e%H%x1f%aI%x1f%B%x1d'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const groups = groupCommits(parseGitLog(log))
  console.log(`작업 ${groups.length}개 (커밋 ${groups.reduce((sum, group) => sum + group.requests.length, 0)}개)`)
  console.log(previewLines(groups).join('\n'))
  if (!process.argv.includes('--apply')) return console.log('\n미리보기만 했어요. 보내려면 --apply')

  let failed = 0
  for (const group of groups) {
    try {
      // 첫 본문이 작업을 만들고, 나머지는 커밋 하나씩 더한다 (이미 있는 작업·커밋이면 서버가 그대로 둠)
      for (const request of group.requests) await postDevLog(request)
    } catch (error) {
      failed += 1
      console.error(`[backfill] ${group.work_key} 실패: ${error.message}`)
    }
  }
  console.log(`보냄 ${groups.length - failed} · 실패 ${failed}`)
  if (failed) process.exit(1)
}

const isMain = () => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}
if (isMain()) await main()
