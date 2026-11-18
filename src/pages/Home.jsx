import TodayPanel from '../components/TodayPanel.jsx'
import WidgetGrid from '../components/WidgetGrid.jsx'

// 홈: 맨 위 "오늘" 칸(보고서 11) → 4개 카테고리 요약 위젯 (모바일 1열, 데스크톱 2x2, 드래그로 순서 변경)
export default function Home() {
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <TodayPanel />
      <WidgetGrid />
    </div>
  )
}
