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

  // 카드를 누르면(edititem) 편집 모달, '+ 새로 만들기'를 누르면(additem) 추가 모달을 연다.
  useEffect(() => {
    const handleEdit = (event) => {
      setEditing(event.detail)
      setIsModalOpen(true)
    }
    const handleAdd = () => setIsModalOpen(true)
    window.addEventListener('edititem', handleEdit)
    window.addEventListener('additem', handleAdd)
    return () => {
      window.removeEventListener('edititem', handleEdit)
      window.removeEventListener('additem', handleAdd)
    }
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
