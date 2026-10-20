import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import Sidebar from './Sidebar.jsx'
import BottomTab from './BottomTab.jsx'
import Header from './Header.jsx'
import Fab from './Fab.jsx'
import AddItemModal from './AddItemModal.jsx'
import CommandPalette from './CommandPalette.jsx'
import useTheme from '../hooks/useTheme.js'

export default function Layout() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const theme = useTheme()

  // 카드 등을 누르면(edititem 이벤트) 해당 항목을 편집 모달로 연다.
  useEffect(() => {
    const handleEdit = (event) => {
      setEditing(event.detail)
      setIsModalOpen(true)
    }
    window.addEventListener('edititem', handleEdit)
    return () => window.removeEventListener('edititem', handleEdit)
  }, [])

  const closeModal = () => {
    setIsModalOpen(false)
    setEditing(null)
  }

  return (
    <>
      <Toaster theme={theme} position="bottom-center" offset={90} mobileOffset={90} />
      <CommandPalette />
      <Sidebar />
      <div className="min-h-screen lg:ml-[var(--sidebar-w,250px)]">
        <Header />
        <main className="@container p-4 pb-40 lg:p-8 lg:pb-24">
          <Outlet />
        </main>
      </div>
      <BottomTab />
      <Fab onClick={() => setIsModalOpen(true)} />
      {isModalOpen && <AddItemModal key={editing?.row.id ?? 'new'} editing={editing} onClose={closeModal} />}
    </>
  )
}
