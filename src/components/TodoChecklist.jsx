import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import DataState from './DataState.jsx'
import DeleteButton from './DeleteButton.jsx'
import useRows from '../hooks/useRows.js'
import { deleteRow, insertRow, updateRow } from '../lib/db.js'
import { STATUS_LABEL, STATUS_PROGRESS } from '../utils/workLog.js'

const fieldClass = 'rounded-md border border-gray-700 bg-transparent px-2 py-1 text-xs text-gray-200 outline-none focus:border-gray-500'

// 회의에서 나온 할 일(work 행, meeting_id = 이 회의)을 체크리스트로 보여 주고 고친다.
// 체크 = 완료 ↔ 할 일, 상태 칸에서 "진행 중"도 고를 수 있다. 바뀔 때마다 onEdited()를 부른다 (회의를 "수정됨"으로 표시).
export default function TodoChecklist({ meetingId, onEdited }) {
  const { rows, setRows, isLoading, reload } = useRows('work')
  const todos = rows.filter((row) => row.meeting_id === meetingId).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  // 저장에 실패하면 올려서 글자 칸(defaultValue)을 저장된 값으로 다시 만든다
  const [version, setVersion] = useState(0)

  // 화면을 먼저 바꾸고 저장한다. 실패하면 바꾼 칸만 이전 값으로 되돌리고, 글자 칸을 그 값으로 다시 만든다.
  const update = async (id, values) => {
    const before = rows.find((row) => row.id === id)
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...values } : row)))
    try {
      await updateRow('work', id, values)
      onEdited()
    } catch {
      toast.error('할 일을 저장하지 못했습니다. 원래대로 되돌립니다')
      if (before) {
        const restore = Object.fromEntries(Object.keys(values).map((key) => [key, before[key] ?? null]))
        setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...restore } : row)))
      }
      setVersion((prev) => prev + 1)
      reload()
    }
  }

  const setStatus = (id, status) => update(id, { status, progress: STATUS_PROGRESS[status] })

  // 글자 칸은 칸을 벗어날 때 저장한다. 바뀐 게 없으면 저장하지 않는다.
  const saveText = (todo, field, input) => {
    const value = input.value.trim()
    if (field === 'title' && !value) {
      input.value = todo.title
      return
    }
    const next = field === 'title' ? value : value || null
    if ((todo[field] ?? null) !== next) update(todo.id, { [field]: next })
  }

  const remove = async (todo) => {
    if (!window.confirm(`할 일 "${todo.title || '제목 없음'}"을 삭제할까요?`)) return
    setRows((prev) => prev.filter((row) => row.id !== todo.id))
    try {
      await deleteRow('work', todo.id)
      onEdited()
    } catch {
      toast.error('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요')
      reload()
    }
  }

  const add = async (event) => {
    event.preventDefault()
    const title = draft.trim()
    if (!title || adding) return
    setAdding(true)
    try {
      const row = await insertRow('work', { title, status: 'Todo', progress: 0, meeting_id: meetingId })
      setRows((prev) => [row, ...prev])
      setDraft('')
      onEdited()
    } catch {
      toast.error('할 일을 추가하지 못했습니다')
    } finally {
      setAdding(false)
    }
  }

  return (
    <section aria-label="할 일" className="flex flex-col gap-2">
      <h2 className="text-lg font-bold text-gray-100">할 일</h2>
      <DataState isLoading={isLoading} isEmpty={false} skeletonRows={2}>
        <ul className="flex flex-col border-y border-gray-700">
          {todos.map((todo) => (
            <li key={`${todo.id}-${version}`} className="group relative flex flex-col gap-1.5 border-b border-gray-700 py-2.5 pr-9 pl-1 last:border-b-0">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={todo.status === 'Done'}
                  onChange={(event) => setStatus(todo.id, event.target.checked ? 'Done' : 'Todo')}
                  aria-label={`${todo.title} 완료`}
                  className="mt-1 h-4 w-4 shrink-0 accent-indigo-500"
                />
                <input
                  type="text"
                  defaultValue={todo.title}
                  maxLength={200}
                  aria-label="할 일 제목"
                  onBlur={(event) => saveText(todo, 'title', event.target)}
                  className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${todo.status === 'Done' ? 'text-gray-400 line-through' : 'text-gray-100'}`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <select
                  value={todo.status}
                  onChange={(event) => setStatus(todo.id, event.target.value)}
                  aria-label="상태"
                  className={`${fieldClass} bg-gray-900`}
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  defaultValue={todo.assignee ?? ''}
                  maxLength={100}
                  placeholder="담당자"
                  aria-label="담당자"
                  onBlur={(event) => saveText(todo, 'assignee', event.target)}
                  className={`${fieldClass} w-24`}
                />
                <input
                  type="date"
                  value={todo.due_date ?? ''}
                  aria-label="마감일"
                  onChange={(event) => update(todo.id, { due_date: event.target.value || null })}
                  className={fieldClass}
                />
              </div>
              <DeleteButton onDelete={() => remove(todo)} label={`${todo.title} 삭제`} className="absolute right-1 top-2" />
            </li>
          ))}
          <li>
            <form onSubmit={add} className="flex items-center gap-2 py-2.5 pl-1">
              <Plus className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={200}
                placeholder="할 일 추가 (Enter)"
                aria-label="새 할 일"
                enterKeyHint="done"
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
              />
            </form>
          </li>
        </ul>
      </DataState>
      <p className="text-xs text-gray-400">할 일은 이 체크리스트가 기준이에요. 아래 내용 속 체크 표시는 할 일과 따로예요.</p>
    </section>
  )
}
