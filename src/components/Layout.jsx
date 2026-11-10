import { Suspense, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import Header from './Header.jsx'
import Fab from './Fab.jsx'
import AddItemModal from './AddItemModal.jsx'
import ScheduleViewModal from './ScheduleViewModal.jsx'
import DayEventsModal from './DayEventsModal.jsx'
import CommandPalette from './CommandPalette.jsx'
import Skeleton from './Skeleton.jsx'
import useTheme from '../hooks/useTheme.js'

// 화면 파일을 받는 동안 본문 자리에 보여 주는 스켈레톤 (머리글·하단 탭은 그대로 남는다)
function PageFallback() {
  return (
    <div role="status" aria-label="화면을 불러오는 중" className="flex flex-col gap-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

export default function Layout() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [prefill, setPrefill] = useState(null)
  const [viewingSchedule, setViewingSchedule] = useState(null)
  const [viewingDay, setViewingDay] = useState(null)
  const theme = useTheme()

  // 카드를 누르면(edititem) 편집 모달, '+ 새로 만들기'나 달력 빈 칸을 두 번 누르면(additem) 추가 모달,
  // 달력의 일정을 두 번 누르면(viewschedule) 일정 보기 모달을 연다.
  useEffect(() => {
    const handleEdit = (event) => {
      setEditing(event.detail)
      setIsModalOpen(true)
    }
    const handleAdd = (event) => {
      setPrefill(event.detail ?? null)
      setIsModalOpen(true)
    }
    const handleView = (event) => setViewingSchedule(event.detail)
    const handleDay = (event) => setViewingDay(event.detail)
    window.addEventListener('viewday', handleDay)
    window.addEventListener('edititem', handleEdit)
    window.addEventListener('additem', handleAdd)
    window.addEventListener('viewschedule', handleView)
    return () => {
      window.removeEventListener('viewday', handleDay)
      window.removeEventListener('edititem', handleEdit)
      window.removeEventListener('additem', handleAdd)
      window.removeEventListener('viewschedule', handleView)
    }
  }, [])

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
    setPrefill(null)
  }

  return (
    <>
      <Toaster theme={theme} position="bottom-center" offset={24} mobileOffset={90} />
      <CommandPalette />
      <div className="min-h-screen">
        <Header />
        <main className="@container p-4 pb-28 lg:p-8 lg:pb-24">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Fab onClick={() => setIsModalOpen(true)} />
      {isModalOpen && <AddItemModal key={editing?.row.id ?? 'new'} editing={editing} prefill={prefill} onClose={closeModal} />}
      {viewingDay && <DayEventsModal date={viewingDay} onClose={() => setViewingDay(null)} />}
      {viewingSchedule && <ScheduleViewModal row={viewingSchedule} onClose={() => setViewingSchedule(null)} />}
    </>
  )
}
