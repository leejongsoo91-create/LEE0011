import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import DevWorkItem from '../components/DevWorkItem.jsx'
// 기록 정리 탭은 열 때 받는다 (작업 모아보기만 보는 때는 가볍게)
const DevDataTab = lazy(() => import('../components/DevDataTab.jsx'))
import Skeleton from '../components/Skeleton.jsx'
import useDevWindow from '../hooks/useDevWindow.js'
import { kstDate } from '../utils/controlTime.js'
import { AGENT_FILTERS, PERIODS, PROJECT_FILTERS, cleanQuery, groupWorks, parseAgent, parseAnchor, parsePeriod, parseProject, periodRange, projectValue, workKeyOf } from '../utils/devWork.js'

const chip = (active) =>
  `rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-gray-300 ${
    active ? 'border-gray-400 bg-gray-700 text-white' : 'border-gray-700 text-gray-400 hover:text-white'
  }`

// 중앙관제 개발 창 (/control/dev, 보고서 12 2단계): 개발 팀 카드를 누르면 관제 위에 뜬다. 폰은 화면 전체, 노트북은 큰 창.
// "작업 모아보기": 고른 역할의 최신 작업 → 주간·월간·연간 목록(펼치면 작업 이유·바꾼 내용·바뀐 파일·보고서·진행 단계) · 검색은 기간과 상관없이 전체.
// 프로젝트(?project=dashboard|stock, 보고서 13): 대시보드·주식 사이트 작업을 같이 또는 따로 본다.
// "기록 정리"(?tab=data): 단계별 기록·작업 목록 표, 작업에 넣기·빼기·고치기·합치기·숨기기·엑셀 파일 (DevDataTab). 화면 글자는 보고서 13에서 한글로.
// 고른 값은 주소에 남긴다 (?agent= &period= &at= &q=). 뒤로 가기·Esc·✕·바깥 누르기로 닫는다.
// 화면 전체에 띄우려고 body에 바로 그린다 (main의 @container 안에서는 fixed가 main 기준이 됨).
// 열려 있는 동안 뒤 화면(#root)은 inert로 막아 Tab이 창 밖으로 나가지 않고, 닫으면 연 자리로 포커스를 돌려준다.
export default function DevWindow() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = kstDate()
  const tab = params.get('tab') === 'data' ? 'data' : 'work'
  const agent = parseAgent(params.get('agent'))
  const projectId = parseProject(params.get('project'))
  const period = parsePeriod(params.get('period'))
  const anchor = parseAnchor(params.get('at'), today)
  const q = cleanQuery(params.get('q'))
  const range = periodRange(period, anchor)
  const data = useDevWindow({ period, anchor, agent, q, project: projectValue(projectId) })
  const [typed, setTyped] = useState(q)
  const titleRef = useRef(null)
  const dialogRef = useRef(null)

  // 주소 값 바꾸기 (방문 기록은 쌓지 않음). 빈 값·기본값은 주소에서 뺀다.
  // 늦게 실행되는 검색 타이머가 그사이 바뀐 값을 지우지 않게 지금 주소를 받아서 고친다
  const update = (patch) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(patch)) value ? next.set(key, value) : next.delete(key)
        return next
      },
      { replace: true },
    )

  // 관제에서 열었으면 뒤로 가기, 주소로 바로 열었으면 관제로
  const close = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/control', { replace: true }))

  useEffect(() => {
    const opener = document.activeElement
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    titleRef.current?.focus()
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // 창 밖(Ctrl+K 검색 팔레트 등 다른 포털)에서 누른 Esc는 그쪽이 처리한다
      if (event.target !== document.body && !dialogRef.current?.contains(event.target)) return
      // 검색칸에 글자가 있을 때 Esc는 글자만 지운다 (브라우저마다 기본 동작이 달라 직접 지움)
      if (event.target instanceof HTMLInputElement && event.target.value) {
        event.preventDefault()
        setTyped('')
        return
      }
      close()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      root?.removeAttribute('inert')
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 검색어는 입력을 멈추고 0.4초 뒤에 주소로
  useEffect(() => {
    const timer = setTimeout(() => cleanQuery(typed) !== q && update({ q: cleanQuery(typed) }), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed])

  // 바깥(어두운 배경)을 누르고 떼었을 때만 닫는다 (창 안에서 글자를 고르다 밖에서 떼면 닫지 않음)
  const pressedOutside = useRef(false)

  const groups = groupWorks(data.shown, q ? 'year' : period, { withYear: Boolean(q) })
  // 작업의 한 줄 기록: 작업 번호와 프로젝트가 같은 것 (두 사이트의 같은 번호가 섞이지 않게)
  const logsOf = (work) => data.logs.filter((row) => workKeyOf(row) === workKeyOf(work))
  const loading = data.status === 'loading'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex bg-black/60 lg:items-center lg:justify-center lg:p-6"
      onMouseDown={(event) => (pressedOutside.current = event.target === event.currentTarget)}
      onClick={(event) => event.target === event.currentTarget && pressedOutside.current && close()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-window-title"
        className="flex h-full w-full flex-col bg-gray-900 lg:h-[90vh] lg:max-w-5xl lg:rounded-2xl lg:border lg:border-gray-700"
      >
        <header className="flex items-center justify-between gap-3 border-b border-gray-700 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <h2 id="dev-window-title" ref={titleRef} tabIndex={-1} className="text-lg font-bold text-white outline-none">
              개발
            </h2>
            <div role="tablist" aria-label="개발 창 탭" className="flex gap-1">
              {[
                { id: 'work', name: '작업 모아보기' },
                { id: 'data', name: '기록 정리' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`dev-tab-${item.id}`}
                  aria-selected={tab === item.id}
                  aria-controls="dev-tab-panel"
                  onClick={() => update({ tab: item.id === 'work' ? '' : item.id })}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${tab === item.id ? 'bg-gray-700 font-semibold text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={close} aria-label="닫기" className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {tab === 'work' && (
        <div className="flex flex-col gap-2 border-b border-gray-700 px-4 py-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="프로젝트 고르기">
            {PROJECT_FILTERS.map((item) => (
              <button key={item.id} type="button" aria-pressed={projectId === item.id} onClick={() => update({ project: item.id === 'all' ? '' : item.id })} className={chip(projectId === item.id)}>
                {item.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="역할 고르기">
            {AGENT_FILTERS.map((item) => (
              <button key={item.id} type="button" aria-pressed={agent === item.id} onClick={() => update({ agent: item.id === 'all' ? '' : item.id })} className={chip(agent === item.id)}>
                {item.name}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 focus-within:border-gray-500">
            <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="sr-only">작업 찾기</span>
            <input
              type="search"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="제목·이유·내용·작업 번호·커밋으로 찾기"
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
            />
          </label>
        </div>

        )}

        <div id="dev-tab-panel" role="tabpanel" aria-labelledby={`dev-tab-${tab}`} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          {tab === 'data' ? (
            <Suspense fallback={<Skeleton className="h-40 w-full" />}>
              <DevDataTab />
            </Suspense>
          ) : (
          <>
          {!q && (
            <section aria-labelledby="dev-latest" className="flex flex-col gap-2">
              <h3 id="dev-latest" className="text-sm font-semibold text-gray-300">
                최신 작업
              </h3>
              {loading && !data.latest ? (
                <Skeleton className="h-16 w-full" />
              ) : data.latest ? (
                <ul className="rounded-xl border border-gray-700 bg-gray-800">
                  <DevWorkItem key={data.latest.id} work={data.latest} logs={logsOf(data.latest)} showProject={projectId === 'all'} defaultOpen />
                </ul>
              ) : (
                <p className="text-sm text-gray-500">아직 작업 기록이 없어요</p>
              )}
            </section>
          )}

          <section aria-labelledby="dev-period" className="flex flex-col gap-3">
            {q ? (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 id="dev-period" className="text-sm font-semibold text-gray-300">
                  "{q}" 찾은 작업 {loading ? '' : `${data.shown.length}건`}
                </h3>
                <button type="button" onClick={() => (setTyped(''), update({ q: '' }))} className="py-1 text-xs text-gray-400 underline hover:text-white">
                  찾기 지우기
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5" role="group" aria-label="기간">
                  {PERIODS.map((item) => (
                    <button key={item.id} type="button" aria-pressed={period === item.id} onClick={() => update({ period: item.id === 'week' ? '' : item.id })} className={chip(period === item.id)}>
                      {item.name}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => update({ at: range.prev })} aria-label="이전 기간" className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <h3 id="dev-period" className="min-w-28 text-center text-sm font-semibold text-gray-200 tabular-nums">
                    {range.label} {loading ? '' : `· ${data.shown.length}건`}
                  </h3>
                  <button type="button" onClick={() => update({ at: range.next })} aria-label="다음 기간" className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {range.from > today || range.to < today ? (
                    <button type="button" onClick={() => update({ at: '' })} className="ml-1 py-1 text-xs text-gray-400 underline hover:text-white">
                      오늘로
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {data.status === 'error' ? (
              <p role="alert" className="text-sm text-gray-400">
                불러오지 못했어요.{' '}
                <button type="button" onClick={data.reload} className="underline hover:text-white">
                  다시 시도
                </button>
              </p>
            ) : loading ? (
              <div role="status" aria-label="불러오는 중" className="flex flex-col gap-2">
                {[0, 1, 2].map((key) => (
                  <Skeleton key={key} className="h-12 w-full" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-700 px-3 py-6 text-center text-sm text-gray-400">
                {q ? '찾은 작업이 없어요' : '이 기간에 작업이 없어요'}
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.key} aria-label={group.label} className="flex flex-col gap-1">
                  <h4 className="flex items-baseline justify-between px-1 text-sm font-semibold text-gray-400">
                    {period === 'year' && !q ? (
                      <button type="button" onClick={() => update({ period: 'month', at: group.key })} className="underline-offset-2 hover:text-white hover:underline">
                        {group.label}
                      </button>
                    ) : (
                      <span>{group.label}</span>
                    )}
                    <span className="text-xs font-normal tabular-nums">{group.items.length}건</span>
                  </h4>
                  <ul className="rounded-xl border border-gray-700 bg-gray-800">
                    {group.items.map((work) => (
                      <DevWorkItem key={work.id} work={work} logs={logsOf(work)} showProject={projectId === 'all'} />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </section>
          </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
