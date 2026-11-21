#!/usr/bin/env node
// 지난 커밋을 작업 단위로 옮기기 (보고서 12, 한 번만). 기본은 미리보기만 찍고 아무것도 보내지 않는다.
//   node scripts/dev-work-backfill.mjs            → 미리보기 표 (작업 번호 · 날짜 · 커밋 수 · 파일 수 · 분야 · 제목)
//   node scripts/dev-work-backfill.mjs --apply    → 사용자가 미리보기를 승인한 뒤에만. 같은 작업 번호는 서버가 합치므로 두 번 돌려도 늘지 않는다
//   주식 사이트 (보고서 13): --project 주식 --repo /root/stockview [--changelog docs/CHANGELOG.md]
//     변경 기록 줄은 짝이 확실한 것만 "바꾼 내용"에 넣고(attachChangelog), 짝 못 지은 줄 수를 알려 준다
// 묶는 기준은 dev-work-lib.mjs의 groupCommits (작업: 줄 → 보고서 번호 → 수정-날짜-순번).

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { postDevLog } from './dev-log.mjs'
import { attachChangelog, checkProjectRepo, groupCommits, parseChangelog, parseGitLog } from './dev-work-lib.mjs'

export function previewLines(groups) {
  return groups.map(({ work_key, requests }) => {
    const head = requests[0]
    const files = new Set(requests.flatMap((request) => request.files.map((file) => file.path)))
    return [work_key, head.started_at.slice(0, 10), `커밋 ${requests.length}`, `파일 ${files.size}`, head.areas.join('·') || '-', head.status, head.title, head.paired ? '기록 연결' : ''].join(' | ')
  })
}

async function main() {
  const arg = (name) => {
    const index = process.argv.indexOf(name)
    return index > 0 ? process.argv[index + 1] : undefined
  }
  const project = arg('--project') ?? '대시보드'
  const repo = arg('--repo')
  const where = repo ? ['-C', repo] : []
  // 다른 저장소의 커밋이 엉뚱한 프로젝트로 들어가지 않게 먼저 확인한다
  let origin = ''
  try {
    origin = execFileSync('git', [...where, 'remote', 'get-url', 'origin'], { encoding: 'utf8' })
  } catch {
    origin = ''
  }
  const problem = checkProjectRepo(project, repo, origin, { projectGiven: process.argv.includes('--project') })
  if (problem) {
    console.error(`[backfill] ${problem}`)
    process.exit(2)
  }
  const log = execFileSync('git', [...where, '-c', 'core.quotepath=off', 'log', '--reverse', '--no-merges', '--numstat', '--format=%x1e%H%x1f%aI%x1f%B%x1d'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const groups = groupCommits(parseGitLog(log), { project })
  const changelogPath = arg('--changelog') ?? (repo && project !== '대시보드' ? 'docs/CHANGELOG.md' : null)
  let note = ''
  if (changelogPath) {
    const file = path.resolve(repo ?? '.', changelogPath)
    if (existsSync(file)) {
      const entries = parseChangelog(readFileSync(file, 'utf8'))
      const result = attachChangelog(groups, entries)
      const works = groups.filter((group) => group.requests[0].paired).length
      note = ` · 변경 기록 ${result.paired}줄을 작업 ${works}개에 연결, ${result.unpaired.length}줄 짝 없음${entries.skipped ? `, ${entries.skipped}줄 못 읽음` : ''}`
    } else note = ' · 변경 기록 파일 없음'
  }
  console.log(`[${project}] 작업 ${groups.length}개 (커밋 ${groups.reduce((sum, group) => sum + group.requests.length, 0)}개)${note}`)
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
