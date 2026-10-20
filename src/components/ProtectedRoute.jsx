import { Navigate, Outlet } from 'react-router-dom'
import Skeleton from './Skeleton.jsx'
import useSession from '../hooks/useSession.js'

// 로그인한 사용자만 하위 페이지를 볼 수 있다. 아니면 로그인 페이지로 보낸다.
export default function ProtectedRoute() {
  const { session, isLoading } = useSession()

  if (isLoading) {
    return (
      <main role="status" aria-label="로그인 상태 확인 중" className="flex min-h-screen items-center justify-center p-4">
        <Skeleton className="h-10 w-48" />
      </main>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
