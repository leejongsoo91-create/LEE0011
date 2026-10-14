import WidgetBox from '../components/WidgetBox.jsx'

// 4개 카테고리 요약 위젯: 모바일 1열, 데스크톱 2x2
export default function Home() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <WidgetBox title="Schedule">여기에 Schedule 데이터 영역</WidgetBox>
      <WidgetBox title="Work">여기에 Work 데이터 영역</WidgetBox>
      <WidgetBox title="Hobbies">여기에 Hobbies 데이터 영역</WidgetBox>
      <WidgetBox title="Investments">여기에 Investments 데이터 영역</WidgetBox>
    </div>
  )
}
