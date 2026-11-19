import { useEffect, useState } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { getRow } from '../lib/db.js'
import { formatAt } from '../utils/controlTime.js'
import { changeLines, commitUrl, currentStep, fileTotals, fileUrl, stepLine, workDay } from '../utils/devWork.js'
import { KIND_LABEL, STATE_STYLE } from '../utils/teamStatus.js'

const STATUS_STYLE = { 완료: STATE_STYLE.pass, 되돌림: STATE_STYLE.idle, '진행 중': STATE_STYLE.running }
const linkClass = 'inline-flex items-center gap-1 text-sky-700 underline underline-offset-2 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300'

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-1">
      <h5 className="text-xs font-semibold text-gray-400">{title}</h5>
      {children}
    </div>
  )
}

// 개발 창의 작업 한 줄 (보고서 12 2단계). 누르면 펼쳐서 왜 · 무엇을 · 코드(파일·줄 수·GitHub) · 보고서 · 진행을 보여 준다.
// 파일 목록은 크기 때문에 펼칠 때 따로 불러온다. logs = 이 작업의 한 줄 기록.
export default function DevWorkItem({ work, logs, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const [detail, setDetail] = useState({ status: 'idle', files: [] })
  const style = STATUS_STYLE[work.status] ?? STATE_STYLE.info
  const step = currentStep(work, logs)

  // 펼칠 때 파일 목록을 불러온다. 실패했으면 다시 펼칠 때 다시 시도한다
  const toggle = () => {
    if (!open && detail.status === 'error') setDetail({ status: 'idle', files: [] })
    setOpen((prev) => !prev)
  }

  useEffect(() => {
    if (!open || detail.status !== 'idle') return
    setDetail({ status: 'loading', files: [] })
    getRow('dev_work', work.id)
      .then((row) => setDetail({ status: 'ready', files: row?.files ?? [] }))
      .catch(() => setDetail({ status: 'error', files: [] }))
  }, [open, detail.status, work.id])

  const lastCommit = work.commits?.at(-1)
  const totals = fileTotals(detail.files)
  const changes = changeLines(work.changes)
  const steps = stepLine(logs)
  const bodyId = `dev-work-${work.id}`

  return (
    <li className="border-b border-gray-700 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={toggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-800/60 focus-visible:outline-2 focus-visible:outline-gray-300"
      >
        <span className="w-11 shrink-0 pt-0.5 text-xs text-gray-400 tabular-nums">{workDay(work).slice(5).replace('-', '/')}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-gray-100">{work.title}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded bg-gray-700 px-1.5 py-0.5 text-gray-200">{work.work_key}</span>
            {(work.areas ?? []).map((area) => (
              <span key={area} className="rounded border border-gray-700 px-1.5 py-0.5 text-gray-400">
                {area}
              </span>
            ))}
          </span>
        </span>
        <span className={`shrink-0 pt-0.5 text-xs ${style.text}`}>
          {style.icon} {step}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={bodyId} className="flex flex-col gap-3 px-3 pt-1 pb-4 text-sm sm:pl-17">
          <Section title="왜">
            <p className={work.reason ? 'whitespace-pre-line text-gray-200' : 'text-gray-500'}>{work.reason || '(기록 없음)'}</p>
          </Section>
          <Section title="무엇을">
            {changes.length ? (
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-gray-200">
                {changes.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">(기록 없음)</p>
            )}
          </Section>
          <Section title={detail.status === 'ready' ? `코드 · 파일 ${detail.files.length}개 +${totals.added} −${totals.removed}` : '코드'}>
            {detail.status === 'loading' && <p className="text-gray-500">불러오는 중…</p>}
            {detail.status === 'error' && <p className="text-gray-500">파일 목록을 불러오지 못했어요</p>}
            {detail.status === 'ready' && (
              <ul className="flex flex-col gap-0.5 text-xs">
                {detail.files.map((file) => {
                  const href = fileUrl(lastCommit, file.path)
                  return (
                    <li key={file.path} className="flex min-w-0 gap-2">
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer" className={`min-w-0 flex-1 truncate ${linkClass}`}>
                          {file.path}
                        </a>
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-gray-300">{file.path}</span>
                      )}
                      <span className="shrink-0 text-gray-400 tabular-nums">
                        +{file.added} −{file.removed}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {(work.commits ?? []).length > 0 && (
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {work.commits.map((hash) =>
                  commitUrl(hash) ? (
                    <a key={hash} href={commitUrl(hash)} target="_blank" rel="noreferrer" className={linkClass}>
                      커밋 {hash} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : (
                    <span key={hash} className="text-gray-400">
                      커밋 {hash}
                    </span>
                  ),
                )}
              </p>
            )}
          </Section>
          {work.report_url && (
            <Section title="보고서">
              <a href={work.report_url} target="_blank" rel="noreferrer" className={`text-xs ${linkClass}`}>
                보고서 열기 <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </Section>
          )}
          {steps.length > 0 && (
            <Section title="진행">
              <ol className="flex flex-col gap-1 text-xs">
                {steps.map((row) => {
                  const rowStyle = STATE_STYLE[row.status] ?? STATE_STYLE.info
                  return (
                    <li key={row.id} className="flex min-w-0 gap-2">
                      <span className={`w-16 shrink-0 ${rowStyle.text}`}>
                        {rowStyle.icon} {KIND_LABEL[row.kind] ?? row.kind}
                      </span>
                      <span className="w-20 shrink-0 text-gray-400 tabular-nums">{formatAt(row.created_at)}</span>
                      <span className="min-w-0 flex-1 text-gray-300">{row.summary}</span>
                    </li>
                  )
                })}
              </ol>
            </Section>
          )}
        </div>
      )}
    </li>
  )
}
