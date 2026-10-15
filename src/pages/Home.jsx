import ScheduleWidget from '../components/ScheduleWidget.jsx'
import WorkWidget from '../components/WorkWidget.jsx'
import HobbiesWidget from '../components/HobbiesWidget.jsx'
import InvestmentsWidget from '../components/InvestmentsWidget.jsx'
import {
  scheduleItems,
  workItems,
  hobbyItems,
  investmentItems,
} from '../data/mockData.js'

// 4개 카테고리 요약 위젯: 모바일 1열, 데스크톱 2x2
export default function Home() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      <ScheduleWidget items={scheduleItems} />
      <WorkWidget items={workItems} />
      <HobbiesWidget items={hobbyItems} />
      <InvestmentsWidget items={investmentItems} />
    </div>
  )
}
