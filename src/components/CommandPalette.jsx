import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { navItems } from './navItems.js'

// Ctrl+K / Cmd+K 로 여는 빠른 검색 팝업. 페이지 이동 메뉴를 보여준다.
export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelect = (path) => {
    navigate(path)
    setOpen(false)
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="빠른 검색"
      overlayClassName="fixed inset-0 z-[60] bg-black/60"
      contentClassName="fixed top-1/2 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl"
    >
      <Command.Input
        placeholder="이동할 페이지를 검색하세요..."
        className="w-full border-b border-gray-700 bg-transparent px-4 py-4 text-gray-100 outline-none placeholder:text-gray-500"
      />
      <Command.List className="max-h-72 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-gray-500">
          결과가 없습니다.
        </Command.Empty>
        <Command.Group
          heading="페이지 이동"
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-gray-500"
        >
          {navItems.map(({ to, label, icon: Icon }) => (
            <Command.Item
              key={to}
              value={label}
              onSelect={() => handleSelect(to)}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-gray-300 data-[selected=true]:bg-gray-700 data-[selected=true]:text-white"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
