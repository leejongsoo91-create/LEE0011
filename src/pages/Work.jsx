import { useSearchParams } from 'react-router-dom'
import CollapsibleMemo from '../components/CollapsibleMemo.jsx'
import OpenTodoList from '../components/OpenTodoList.jsx'
import WorkLogList from '../components/WorkLogList.jsx'
import WorkSummaryBar from '../components/WorkSummaryBar.jsx'
import { parseWorkFilter } from '../utils/today.js'

// 업무 탭: 요약 → 남은 할 일 → 업무 기록(날짜별 제목, 누르면 상세) → 메모(노션 본문, 기본은 접힘)
// 요약 숫자로 고른 걸러 보기는 주소(?show=)에 남겨, 상세에서 뒤로 와도 유지되고 홈에서 바로 연결된다.
export default function Work() {
  const [params, setParams] = useSearchParams()
  const show = parseWorkFilter(params.get('show'))
  // 같은 숫자를 다시 누르면 풀린다. 누를 때마다 방문 기록이 쌓이지 않게 주소를 바꿔치기한다.
  const setShow = (value) => setParams(value ? { show: value } : {}, { replace: true })
  const toggle = (key) => setShow(show === key ? '' : key)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <WorkSummaryBar show={show} onToggle={toggle} />
      {show !== 'meetings' && <OpenTodoList show={show} onClear={() => setShow('')} />}
      <WorkLogList recentOnly={show === 'meetings'} onClear={() => setShow('')} />
      <CollapsibleMemo path="/work" name="업무" storageKey="work-memo-open" className="-mt-4" />
    </div>
  )
}
