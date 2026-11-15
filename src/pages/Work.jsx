import CollapsibleMemo from '../components/CollapsibleMemo.jsx'
import WorkLogList from '../components/WorkLogList.jsx'
import WorkSummaryBar from '../components/WorkSummaryBar.jsx'

// 업무 탭: 요약 → 업무 기록(날짜별 제목, 누르면 상세) → 메모(노션 본문, 기본은 접힘)
export default function Work() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <WorkSummaryBar />
      <WorkLogList />
      <CollapsibleMemo path="/work" name="업무" storageKey="work-memo-open" className="-mt-4" />
    </div>
  )
}
