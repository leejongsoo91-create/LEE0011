import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { signOut } from '../lib/auth.js'

// 로그아웃 아이콘 버튼. 로그아웃하면 보호된 화면에서 로그인 페이지로 이동한다.
export default function LogoutButton() {
  const handleClick = async () => {
    try {
      await signOut()
    } catch {
      toast.error('로그아웃하지 못했습니다')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="로그아웃"
      className="-my-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-white"
    >
      <LogOut className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
