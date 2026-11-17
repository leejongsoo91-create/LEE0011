import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { describeAuthError, signIn } from '../lib/auth.js'
import useSession from '../hooks/useSession.js'
import useTheme from '../hooks/useTheme.js'

const inputClass =
  'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-400'

// 이메일/비밀번호 로그인 화면. 혼자 쓰는 대시보드라 회원가입은 없다 (보고서 10). 이미 로그인했다면 홈으로 보낸다.
export default function Login() {
  const { session } = useSession()
  const theme = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const run = async (action, successMessage) => {
    setIsBusy(true)
    try {
      await action()
      if (successMessage) toast(successMessage)
    } catch (error) {
      toast.error(describeAuthError(error))
    } finally {
      setIsBusy(false)
    }
  }

  const handleLogin = (event) => {
    event.preventDefault()
    run(async () => {
      await signIn(email, password)
      toast('로그인되었습니다')
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Toaster theme={theme} position="bottom-center" />
      <form onSubmit={handleLogin} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-gray-800 p-6">
        <header>
          <h1 className="text-xl font-bold text-white">내 대시보드</h1>
          <p className="mt-1 text-sm text-gray-400">로그인하고 내 데이터를 확인하세요</p>
        </header>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          이메일
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-400">
          비밀번호
          <input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" className={inputClass} />
        </label>
        <button type="submit" disabled={isBusy} className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-[white] transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">
          {isBusy ? '처리 중...' : '로그인'}
        </button>
      </form>
    </main>
  )
}
