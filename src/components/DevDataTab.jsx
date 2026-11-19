import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import Skeleton from './Skeleton.jsx'
import { devDataCounts, listDevLogsAdmin, listDevWorksAdmin } from '../lib/db.js'
import { runDevAdmin } from '../lib/devAdmin.js'
import { formatAt, kstDate } from '../utils/controlTime.js'
import { ADMIN_ERROR, DATA_PERIODS, dataRange, toCsv } from '../utils/devWork.js'
import { KIND_LABEL, STATE_LABEL, TEAM } from '../utils/teamStatus.js'

const PAGE = 100
const MAX_PICK = 200 // 서버가 한 번에 받는 기록 수 (api/dev-admin.js MAX_IDS)
const AREAS = ['화면', '에이전트', 'DB', '보안', '개발도구', '문서', '설정']
const STATUSES = ['진행 중', '완료', '되돌림']
const KEY_HINT = '보고서12-3 또는 수정-20261120-1'
const fieldClass = 'rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 outline-none focus:border-gray-500'
const buttonClass = 'rounded-md border border-gray-600 px-2.5 py-1 text-xs text-gray-200 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50'
const chip = (active) =>
  `rounded-full border px-3 py-1 text-xs transition-colors ${active ? 'border-gray-400 bg-gray-700 text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`

const LOG_COLUMNS = [
  { key: 'created_at', label: '시각' },
  { key: 'agent', label: '에이전트' },
  { key: 'kind', label: '종류' },
  { key: 'status', label: '결과' },
  { key: 'work_key', label: '작업 번호' },
  { key: 'summary', label: '요약' },
  { key: 'ref', label: '커밋·주소' },
]
const WORK_COLUMNS = [
  { key: 'work_key', label: '작업 번호' },
  { key: 'started_at', label: '시작' },
  { key: 'finished_at', label: '끝' },
  { key: 'status', label: '상태' },
  { key: 'areas', label: '분야' },
  { key: 'title', label: '제목' },
  { key: 'reason', label: '왜' },
  { key: 'changes', label: '무엇을' },
  { key: 'commits', label: '커밋' },
  { key: 'report_url', label: '보고서' },
]

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 정리 요청 공통: 성공하면 알림 후 새로 읽고, 실패하면 이유를 알린다
async function act(body, done, onChanged) {
  try {
    const result = await runDevAdmin(body)
    toast(done(result.changed))
    onChanged()
    return true
  } catch (error) {
    toast.error(ADMIN_ERROR[error.message] ?? '정리하지 못했어요. 잠시 후 다시 시도해 주세요')
    return false
  }
}

// 개발 창 "데이터 관리" 탭 (보고서 12 3단계): 원본 기록(dev_log)과 작업(dev_work)을 표로 보고 정리한다.
// 정리(묶기·풀기·고치기·합치기·숨기기)는 /api/dev-admin이 주인 확인 뒤 하고, 정리할 때마다 한 줄 기록을 남긴다.
// 지우기는 없다. 숨긴 것은 "숨긴 것 보기"에서 되살린다. 거른 표는 CSV로 내려받는다.
export default function DevDataTab() {
  const today = kstDate()
  const [view, setView] = useState('logs')
  const [counts, setCounts] = useState(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((prev) => prev + 1), [])

  useEffect(() => {
    let cancelled = false
    devDataCounts()
      .then((data) => !cancelled && setCounts(data))
      .catch(() => !cancelled && setCounts({ error: true }))
    return () => {
      cancelled = true
    }
  }, [version])

  const oldest = counts?.oldest ? kstDate(new Date(counts.oldest)) : null
  const stats = [
    { label: '한 줄 기록', value: counts?.logs },
    { label: '작업에 안 묶인 기록', value: counts?.unassigned },
    { label: '작업', value: counts?.works },
    { label: '가장 오래된 기록', value: oldest, sub: oldest ? `${Number(oldest.slice(0, 4)) + 5}${oldest.slice(4)} 지워짐(5년)` : '' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="현황" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5">
            <p className="text-xs text-gray-400">{stat.label}</p>
            <p className="text-lg font-bold text-white tabular-nums">{counts == null ? '—' : counts.error ? '!' : (stat.value ?? '—')}</p>
            {stat.sub && <p className="text-[11px] text-gray-500 tabular-nums">{stat.sub}</p>}
          </div>
        ))}
      </section>
      <div className="flex gap-1.5" role="group" aria-label="볼 표">
        <button type="button" aria-pressed={view === 'logs'} onClick={() => setView('logs')} className={chip(view === 'logs')}>
          원본 기록
        </button>
        <button type="button" aria-pressed={view === 'works'} onClick={() => setView('works')} className={chip(view === 'works')}>
          작업
        </button>
      </div>
      {view === 'logs' ? <LogTable today={today} version={version} onChanged={reload} /> : <WorkTable today={today} version={version} onChanged={reload} />}
    </div>
  )
}

// 불러오기 공통: 거르기(key, 꼭 문자열 — 배열·객체면 렌더마다 달라져 끝없이 다시 그림)가 바뀌면 처음부터, "더 보기"면 이어서. 실패하면 같은 자리를 다시 부를 수 있다
// (page.n이 바뀔 때마다 부르므로 같은 offset으로 다시 시도해도 요청이 나간다)
function usePaged(load, key) {
  const [state, setState] = useState({ status: 'loading', rows: [], more: false })
  const [page, setPage] = useState({ key, offset: 0, n: 0 })
  // 거르기가 바뀌면 렌더 중에 처음 쪽으로 되돌린다 (옛 offset으로 한 번 더 부르지 않게)
  if (page.key !== key) setPage({ key, offset: 0, n: page.n + 1 })
  useEffect(() => {
    if (page.key !== key) return
    let cancelled = false
    const { offset } = page
    setState((prev) => ({ ...prev, status: offset === 0 ? 'loading' : 'more' }))
    load(offset)
      .then((rows) => !cancelled && setState((prev) => ({ status: 'ready', rows: offset === 0 ? rows : [...prev.rows, ...rows], more: rows.length === PAGE })))
      .catch(() => !cancelled && setState((prev) => ({ ...prev, status: 'error' })))
    return () => {
      cancelled = true
    }
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps
  const next = (offset) => setPage((prev) => ({ ...prev, offset, n: prev.n + 1 }))
  return { ...state, loadMore: () => next(state.rows.length), retry: () => next(page.offset) }
}

function Filters({ children, onCsv, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {children}
      <button type="button" onClick={onCsv} disabled={disabled} className={`${buttonClass} ml-auto`}>
        CSV 내려받기
      </button>
    </div>
  )
}

function ListState({ data, empty, children }) {
  if (data.status === 'loading') {
    return (
      <div role="status" aria-label="불러오는 중" className="flex flex-col gap-2">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    )
  }
  if (data.status === 'error' && data.rows.length === 0) {
    return (
      <p role="alert" className="text-sm text-gray-400">
        불러오지 못했어요.{' '}
        <button type="button" onClick={data.retry} className="underline hover:text-white">
          다시 시도
        </button>
      </p>
    )
  }
  if (data.rows.length === 0) return <p className="rounded-lg border border-dashed border-gray-700 px-3 py-6 text-center text-sm text-gray-400">{empty}</p>
  return (
    <>
      {children}
      {data.status === 'error' ? (
        <p role="alert" className="self-center text-xs text-gray-400">
          더 불러오지 못했어요.{' '}
          <button type="button" onClick={data.retry} className="underline hover:text-white">
            다시 시도
          </button>
        </p>
      ) : (
        data.more && (
          <button type="button" onClick={data.loadMore} disabled={data.status === 'more'} className={`${buttonClass} self-center`}>
            {data.status === 'more' ? '불러오는 중…' : `${PAGE}줄 더 보기`}
          </button>
        )
      )}
    </>
  )
}

function LogTable({ today, version, onChanged }) {
  const [period, setPeriod] = useState('month')
  const [agent, setAgent] = useState('')
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const [unassigned, setUnassigned] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const data = usePaged(
    (offset) => listDevLogsAdmin({ ...dataRange(period, today), agent, kind, status, unassigned, hidden, offset, limit: PAGE }),
    JSON.stringify([period, agent, kind, status, unassigned, hidden, version, today]),
  )

  useEffect(() => setSelected(new Set()), [period, agent, kind, status, unassigned, hidden, version])
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const ids = [...selected]
  const run = async (body, done) => {
    if (ids.length > MAX_PICK) return
    setBusy(true)
    await act(body, done, onChanged)
    setBusy(false)
  }

  return (
    <section aria-label="원본 기록" className="flex flex-col gap-3">
      <Filters onCsv={() => download(`개발기록-${today}.csv`, toCsv(LOG_COLUMNS, data.rows))} disabled={data.rows.length === 0}>
        <select aria-label="기간" value={period} onChange={(event) => setPeriod(event.target.value)} className={fieldClass}>
          {DATA_PERIODS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select aria-label="에이전트" value={agent} onChange={(event) => setAgent(event.target.value)} className={fieldClass}>
          <option value="">에이전트 전체</option>
          {TEAM.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <select aria-label="종류" value={kind} onChange={(event) => setKind(event.target.value)} className={fieldClass}>
          <option value="">종류 전체</option>
          {Object.entries(KIND_LABEL).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="결과" value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClass}>
          <option value="">결과 전체</option>
          {['running', 'pass', 'fail', 'info'].map((id) => (
            <option key={id} value={id}>
              {STATE_LABEL[id]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-gray-300">
          <input type="checkbox" checked={unassigned} onChange={(event) => setUnassigned(event.target.checked)} /> 안 묶인 것만
        </label>
        <label className="flex items-center gap-1 text-gray-300">
          <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} /> 숨긴 것 보기
        </label>
      </Filters>

      {ids.length > 0 && (
        <div className="sticky -top-4 z-10 flex shadow-lg flex-wrap items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs">
          <span className="font-semibold text-white">{ids.length}줄 고름</span>
          {ids.length > MAX_PICK && <span className="text-amber-700 dark:text-amber-400">한 번에 {MAX_PICK}줄까지 정리할 수 있어요</span>}
          <input aria-label="묶을 작업 번호" value={target} onChange={(event) => setTarget(event.target.value.trim())} placeholder={KEY_HINT} className={`${fieldClass} w-44`} />
          <button type="button" disabled={busy || !target || ids.length > MAX_PICK} onClick={() => run({ action: 'assign', log_ids: ids, work_key: target }, (n) => `${n}줄을 ${target}에 묶었어요`)} className={buttonClass}>
            작업에 묶기
          </button>
          <button type="button" disabled={busy || ids.length > MAX_PICK} onClick={() => run({ action: 'unassign', log_ids: ids }, (n) => `${n}줄의 묶음을 풀었어요`)} className={buttonClass}>
            묶음 풀기
          </button>
          <button
            type="button"
            disabled={busy || ids.length > MAX_PICK}
            onClick={() => (hidden || window.confirm(`${ids.length}줄을 숨길까요? "숨긴 것 보기"에서 되살릴 수 있어요.`)) && run({ action: 'hide', target: 'log', ids, hidden: !hidden }, (n) => `${n}줄을 ${hidden ? '되살렸어요' : '숨겼어요'}`)}
            className={buttonClass}
          >
            {hidden ? '되살리기' : '숨기기'}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-gray-400 underline hover:text-white">
            고르기 취소
          </button>
        </div>
      )}

      <ListState data={data} empty={hidden ? '숨긴 기록이 없어요' : '이 조건의 기록이 없어요'}>
        <ul className="flex flex-col rounded-xl border border-gray-700 bg-gray-800">
          {data.rows.map((row) => (
            <li key={row.id} className="border-b border-gray-700 last:border-b-0">
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-xs hover:bg-gray-700/40">
                <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} className="mt-0.5" aria-label={`${row.summary} 고르기`} />
                <span className="w-20 shrink-0 text-gray-400 tabular-nums">{formatAt(row.created_at)}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-gray-100 [overflow-wrap:anywhere]">{row.summary}</span>
                  <span className="text-gray-400">
                    {TEAM.find((member) => member.id === row.agent)?.name.split('/')[0] ?? row.agent} · {KIND_LABEL[row.kind] ?? row.kind} · {STATE_LABEL[row.status] ?? row.status}
                    {row.ref ? ` · ${row.ref.slice(0, 12)}` : ''}
                  </span>
                </span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 ${row.work_key ? 'bg-gray-700 text-gray-200' : 'border border-dashed border-gray-600 text-gray-500'}`}>{row.work_key ?? '안 묶임'}</span>
              </label>
            </li>
          ))}
        </ul>
      </ListState>
    </section>
  )
}

function WorkTable({ today, version, onChanged }) {
  const [period, setPeriod] = useState('year')
  const [area, setArea] = useState('')
  const [status, setStatus] = useState('')
  const [noReason, setNoReason] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [editing, setEditing] = useState(null)
  const data = usePaged(
    (offset) => listDevWorksAdmin({ ...dataRange(period, today), area, status, noReason, hidden, offset, limit: PAGE }),
    JSON.stringify([period, area, status, noReason, hidden, version, today]),
  )
  // 숨긴 것 보기를 바꾸거나 새로 읽으면 열려 있던 고치기 칸을 닫는다
  useEffect(() => setEditing(null), [hidden, version])

  return (
    <section aria-label="작업" className="flex flex-col gap-3">
      <Filters onCsv={() => download(`개발작업-${today}.csv`, toCsv(WORK_COLUMNS, data.rows))} disabled={data.rows.length === 0}>
        <select aria-label="기간" value={period} onChange={(event) => setPeriod(event.target.value)} className={fieldClass}>
          {DATA_PERIODS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select aria-label="분야" value={area} onChange={(event) => setArea(event.target.value)} className={fieldClass}>
          <option value="">분야 전체</option>
          {AREAS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <select aria-label="상태" value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClass}>
          <option value="">상태 전체</option>
          {STATUSES.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-gray-300">
          <input type="checkbox" checked={noReason} onChange={(event) => setNoReason(event.target.checked)} /> 이유 없는 것만
        </label>
        <label className="flex items-center gap-1 text-gray-300">
          <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} /> 숨긴 것 보기
        </label>
      </Filters>

      <ListState data={data} empty={hidden ? '숨긴 작업이 없어요' : '이 조건의 작업이 없어요'}>
        <ul className="flex flex-col rounded-xl border border-gray-700 bg-gray-800">
          {data.rows.map((work) => (
            <li key={work.id} className="flex flex-col gap-2 border-b border-gray-700 px-3 py-2.5 text-xs last:border-b-0">
              <div className="flex flex-wrap items-start gap-2">
                <span className="rounded bg-gray-700 px-1.5 py-0.5 text-gray-200">{work.work_key}</span>
                <span className="min-w-0 flex-1 text-sm text-gray-100">{work.title}</span>
                <span className="text-gray-400 tabular-nums">
                  {kstDate(new Date(work.started_at)).slice(5)} · {work.status}
                </span>
              </div>
              <p className="text-gray-400">
                {(work.areas ?? []).join('·') || '분야 없음'} · 커밋 {(work.commits ?? []).length} · {work.reason ? '이유 있음' : <span className="text-amber-700 dark:text-amber-400">이유 없음</span>}
              </p>
              {editing === work.id ? (
                <WorkEditor work={work} onDone={() => setEditing(null)} onChanged={onChanged} />
              ) : (
                <WorkActions work={work} hidden={hidden} onEdit={() => setEditing(work.id)} onChanged={onChanged} />
              )}
            </li>
          ))}
        </ul>
      </ListState>
    </section>
  )
}

function WorkActions({ work, hidden, onEdit, onChanged }) {
  const [busy, setBusy] = useState(false)
  const run = async (body, done) => {
    setBusy(true)
    await act(body, done, onChanged)
    setBusy(false)
  }
  const merge = () => {
    const into = window.prompt(`${work.work_key}을 어느 작업에 합칠까요? 작업 번호를 적어 주세요 (${KEY_HINT}).\n커밋·파일·기록이 옮겨지고 ${work.work_key}은 숨겨져요.`)?.trim()
    if (into) run({ action: 'merge', from: work.work_key, into }, () => `${work.work_key}을 ${into}에 합쳤어요`)
  }
  return (
    <div className="flex flex-wrap gap-2">
      {!hidden && (
        <>
          <button type="button" disabled={busy} onClick={onEdit} className={buttonClass}>
            고치기
          </button>
          <button type="button" disabled={busy} onClick={merge} className={buttonClass}>
            다른 작업에 합치기
          </button>
        </>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => (hidden || window.confirm(`${work.work_key}을 숨길까요? "숨긴 것 보기"에서 되살릴 수 있어요.`)) && run({ action: 'hide', target: 'work', ids: [work.id], hidden: !hidden }, () => `${work.work_key}을 ${hidden ? '되살렸어요' : '숨겼어요'}`)}
        className={buttonClass}
      >
        {hidden ? '되살리기' : '숨기기'}
      </button>
    </div>
  )
}

// 작업 고치기: 제목·이유·바꾼 내용·분야·상태·보고서. 바뀐 칸만 보낸다
function WorkEditor({ work, onDone, onChanged }) {
  const [form, setForm] = useState({
    title: work.title ?? '',
    reason: work.reason ?? '',
    changes: work.changes ?? '',
    areas: work.areas ?? [],
    status: work.status,
    report_url: work.report_url ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (name) => (event) => setForm((prev) => ({ ...prev, [name]: event.target.value }))
  const toggleArea = (name) => setForm((prev) => ({ ...prev, areas: prev.areas.includes(name) ? prev.areas.filter((area) => area !== name) : [...prev.areas, name] }))
  const original = { title: work.title ?? '', reason: work.reason ?? '', changes: work.changes ?? '', areas: work.areas ?? [], status: work.status, report_url: work.report_url ?? '' }
  // 바뀐 칸만 보낸다. 분야는 순서와 상관없이 비교하고, 보고서 주소는 앞뒤 공백을 뗀다
  const same = (name, value) =>
    name === 'areas' ? [...value].sort().join() === [...original.areas].sort().join() : value === original[name]
  const fields = Object.fromEntries(
    Object.entries({ ...form, report_url: form.report_url.trim() }).filter(([name, value]) => !same(name, value)),
  )
  const changed = Object.keys(fields).length > 0

  const save = async (event) => {
    event.preventDefault()
    if (!changed) return onDone()
    setBusy(true)
    const ok = await act({ action: 'edit', work_key: work.work_key, fields }, () => `${work.work_key}을 고쳤어요`, onChanged)
    setBusy(false)
    if (ok) onDone()
  }

  const label = 'flex flex-col gap-1 text-gray-400'
  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-lg border border-gray-700 bg-gray-900 p-3">
      <label className={label}>
        제목
        <input value={form.title} onChange={set('title')} maxLength={200} required className={fieldClass} />
      </label>
      <label className={label}>
        왜 (이유)
        <textarea value={form.reason} onChange={set('reason')} maxLength={1000} rows={2} className={fieldClass} />
      </label>
      <label className={label}>
        무엇을 (한 줄에 하나, "- "로 시작)
        <textarea value={form.changes} onChange={set('changes')} maxLength={2000} rows={3} className={fieldClass} />
      </label>
      <fieldset className="flex flex-wrap gap-2 text-gray-300">
        <legend className="mb-1 text-gray-400">분야</legend>
        {AREAS.map((name) => (
          <label key={name} className="flex items-center gap-1">
            <input type="checkbox" checked={form.areas.includes(name)} onChange={() => toggleArea(name)} /> {name}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <label className={label}>
          상태
          <select value={form.status} onChange={set('status')} className={fieldClass}>
            {STATUSES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className={`${label} min-w-0 flex-1`}>
          보고서 주소
          <input value={form.report_url} onChange={set('report_url')} placeholder="https://claude.ai/..." className={fieldClass} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} disabled={busy} className="px-2 py-1 text-gray-400 hover:text-white">
          취소
        </button>
        <button type="submit" disabled={busy || !changed} className={buttonClass}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}
