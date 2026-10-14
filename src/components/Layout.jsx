import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import BottomTab from './BottomTab.jsx'
import Header from './Header.jsx'
import Fab from './Fab.jsx'
import AddItemModal from './AddItemModal.jsx'

// 모든 페이지가 공유하는 공통 레이아웃
export default function Layout() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <Sidebar />
      <div className="min-h-screen lg:ml-[250px]">
        <Header />
        <main className="p-4 pb-40 lg:p-8 lg:pb-24">
          <Outlet />
        </main>
      </div>
      <BottomTab />
      <Fab onClick={() => setIsModalOpen(true)} />
      {isModalOpen && <AddItemModal onClose={() => setIsModalOpen(false)} />}
    </>
  )
}
