import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import TitleInput from '../components/TitleInput.jsx'
import NotionEditor from '../components/NotionEditor.jsx'
import Skeleton from '../components/Skeleton.jsx'
import TodoChecklist from '../components/TodoChecklist.jsx'
import MeetingSummaryView from '../components/MeetingSummaryView.jsx'
import { SaveStatus } from '../components/NotionPage.jsx'
import useAutoSave from '../hooks/useAutoSave.js'
import { deleteRow, deleteRowsWhere, getRow, listRows, notifyDataChange, updateRow } from '../lib/db.js'
import { meetingTime } from '../utils/meetingSummary.js'
import { saveTitle } from '../utils/pageTitle.js'
import { STATUS_LABEL, STATUS_PROGRESS, isRowId, summaryToEditorBlocks } from '../utils/workLog.js'

// 업무 상세 (/work/<id>): 회의 기록(Plaud) 또는 직접 만든 업무 하나를 열어 제목·내용을 고친다 (입력을 멈추면 자동 저장).
// 회의 기록은 할 일 체크리스트와 원본 요약 보기가 더 있다.
export default function WorkDetail() {
  const { id } = useParams()
  // 다른 업무로 옮겨 가면 불러오기·저장 상태를 새로 시작한다.
  return <DetailLoader key={id} id={id} />
}

function DetailLoader({ id }) {
  const [state, setState] = useState({ status: 'loading' })

  const load = useCallback(async () => {
    if (!isRowId(id)) return setState({ status: 'missing' })
    setState({ status: 'loading' })
    try {
      const meeting = await getRow('work_meetings', id)
      if (meeting) return setState({ status: 'ready', kind: 'meeting', row: meeting })
      const task = await getRow('work', id)
      // 회의에서 나온 할 일은 따로 열지 않고, 그 회의 상세로 보낸다
      if (task?.meeting_id) return setState({ status: 'redirect', to: task.meeting_id })
      setState(task ? { status: 'ready', kind: 'task', row: task } : { status: 'missing' })
    } catch {
      setState({ status: 'error' })
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const navigate = useNavigate()
  useEffect(() => {
    if (state.status === 'redirect') navigate(`/work/${state.to}`, { replace: true })
  }, [state, navigate])

  if (state.status === 'ready') return state.kind === 'meeting' ? <MeetingDetail meeting={state.row} /> : <TaskDetail task={state.row} />

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-6 py-4 lg:py-8">
      <BackLink />
      {state.status === 'missing' ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-gray-700 p-6 text-sm">
          <p className="text-gray-300">이 업무를 찾을 수 없어요. 지워졌거나 주소가 틀렸을 수 있어요.</p>
          <Link to="/work" className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-900 hover:bg-white">
            업무 목록으로
          </Link>
        </div>
      ) : state.status === 'error' ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-gray-700 p-6 text-sm">
          <p className="text-gray-300">불러오지 못했습니다. 내용을 지키기 위해 편집을 잠시 막았어요.</p>
          <button type="button" onClick={load} className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-900 hover:bg-white">
            다시 불러오기
          </button>
        </div>
      ) : (
        <div role="status" aria-label="불러오는 중" className="flex flex-col gap-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
        </div>
      )}
    </article>
  )
}

function BackLink() {
  return (
    <Link to="/work" className="inline-flex items-center gap-1.5 self-start text-sm text-gray-400 transition-colors hover:text-white">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      업무 목록
    </Link>
  )
}

// 제목 칸: 비우면 "제목 없음"으로 저장한다 (회의 기록은 제목이 꼭 있어야 한다). 빵부스러기에도 반영한다.
function useTitle(path, initial, change) {
  useEffect(() => saveTitle(path, initial), [path, initial])
  return (value) => {
    saveTitle(path, value)
    change('title', value.trim() || '제목 없음')
  }
}

function MeetingDetail({ meeting }) {
  const path = `/work/${meeting.id}`
  const navigate = useNavigate()
  const [edited, setEdited] = useState(Boolean(meeting.edited_at))
  const markedRef = useRef(Boolean(meeting.edited_at))

  // 고친 내용을 저장할 때마다 edited_at도 함께 바꾼다 (텔레그램 "원복"이 고친 회의를 지우지 않게).
  const save = useCallback(
    async (values) => {
      await updateRow('work_meetings', meeting.id, { ...values, edited_at: new Date().toISOString() })
      // 화면을 떠나며 저장하는 경우에도 목록이 새 제목을 받게 한다 (내용만 바뀌면 알리지 않는다)
      if ('title' in values) notifyDataChange()
      markedRef.current = true
      setEdited(true)
    },
    [meeting.id],
  )
  const { saveState, change } = useAutoSave(save)
  const handleTitle = useTitle(path, meeting.title, change)

  // 할 일을 고쳐도 회의를 "수정됨"으로 표시한다 (한 번만).
  const markEdited = useCallback(async () => {
    if (markedRef.current) return
    markedRef.current = true
    try {
      await updateRow('work_meetings', meeting.id, { edited_at: new Date().toISOString() })
      setEdited(true)
    } catch {
      markedRef.current = false
    }
  }, [meeting.id])

  // 처음 고치기 전에는 Plaud 원본 요약을 블록으로 바꿔 보여 준다
  const [initialContent] = useState(() => meeting.content ?? summaryToEditorBlocks(meeting.summary_md))

  const remove = async () => {
    let todos = []
    try {
      todos = (await listRows('work')).filter((row) => row.meeting_id === meeting.id)
    } catch {
      toast.error('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요')
      return
    }
    const message = todos.length > 0 ? `이 회의 기록과 할 일 ${todos.length}개를 함께 삭제할까요?` : '이 회의 기록을 삭제할까요?'
    if (!window.confirm(message)) return
    try {
      // 할 일부터 지운다 (회의만 지우면 할 일이 목록에 따로 흩어진다)
      await deleteRowsWhere('work', 'meeting_id', meeting.id)
      await deleteRow('work_meetings', meeting.id)
      notifyDataChange()
      toast('삭제했습니다')
      navigate('/work', { replace: true })
    } catch {
      notifyDataChange()
      toast.error('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요')
    }
  }

  return (
    <article className="relative mx-auto flex max-w-4xl flex-col gap-6 py-4 lg:py-8">
      <SaveStatus state={saveState} />
      <BackLink />
      <header className="flex flex-col gap-2">
        <TitleInput size="page" defaultValue={meeting.title} maxLength={200} onValueChange={handleTitle} />
        <p className="text-sm text-gray-400">
          🎙 {meetingTime(meeting.recorded_at ?? meeting.created_at) || '시각 모름'}
          {edited && ' · 수정됨'}
        </p>
      </header>
      <TodoChecklist meetingId={meeting.id} onEdited={markEdited} />
      <section aria-label="내용" className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-gray-100">내용</h2>
        <NotionEditor initialContent={initialContent} onDocumentChange={(document) => change('content', document)} />
      </section>
      <details className="rounded-xl border border-gray-700 px-4 py-3">
        <summary className="cursor-pointer text-sm text-gray-300">원본 요약 보기 (Plaud)</summary>
        <div className="mt-3">
          <MeetingSummaryView markdown={meeting.summary_md} />
          <p className="mt-3 text-xs text-gray-400">녹취록 전문은 Plaud 앱에서 볼 수 있어요.</p>
        </div>
      </details>
      <DeleteFooter onDelete={remove} label="회의 기록 삭제" />
    </article>
  )
}

function TaskDetail({ task }) {
  const path = `/work/${task.id}`
  const navigate = useNavigate()
  const [status, setStatus] = useState(task.status)

  const save = useCallback(
    async (values) => {
      await updateRow('work', task.id, values)
      if ('title' in values) notifyDataChange()
    },
    [task.id],
  )
  const { saveState, change } = useAutoSave(save)
  const handleTitle = useTitle(path, task.title, change)

  const changeStatus = async (next) => {
    const before = status
    setStatus(next)
    try {
      await updateRow('work', task.id, { status: next, progress: STATUS_PROGRESS[next] })
    } catch {
      setStatus(before)
      toast.error('상태를 저장하지 못했습니다')
    }
  }

  const remove = async () => {
    if (!window.confirm('이 업무를 삭제할까요?')) return
    try {
      await deleteRow('work', task.id)
      notifyDataChange()
      toast('삭제했습니다')
      navigate('/work', { replace: true })
    } catch {
      toast.error('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요')
    }
  }

  return (
    <article className="relative mx-auto flex max-w-4xl flex-col gap-6 py-4 lg:py-8">
      <SaveStatus state={saveState} />
      <BackLink />
      <header className="flex flex-col gap-3">
        <TitleInput size="page" defaultValue={task.title} onValueChange={handleTitle} />
        <label className="flex items-center gap-2 text-sm text-gray-400">
          상태
          <select
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
            className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-200 outline-none focus:border-gray-500"
          >
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <section aria-label="내용">
        <NotionEditor initialContent={task.content} onDocumentChange={(document) => change('content', document)} />
      </section>
      <DeleteFooter onDelete={remove} label="업무 삭제" />
    </article>
  )
}

function DeleteFooter({ onDelete, label }) {
  return (
    <footer className="flex justify-end border-t border-gray-700 pt-4">
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    </footer>
  )
}
