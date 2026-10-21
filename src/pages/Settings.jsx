import { useState } from 'react'
import { toast } from 'sonner'
import useSession from '../hooks/useSession.js'
import { deleteMyAccount, describeAuthError, updatePassword } from '../lib/auth.js'

const inputClass =
  'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-indigo-400'
const cardClass = 'flex flex-col gap-4 rounded-xl bg-gray-800 p-5'

// 로그인한 계정 정보 확인, 비밀번호 변경, 계정 삭제를 모은 설정 페이지
export default function Settings() {
  const { session } = useSession()
  const email = session?.user.email ?? ''

  return (
    <section aria-label="설정" className="mx-auto flex max-w-2xl flex-col gap-4 pb-8">
      <h2 className="text-xl font-bold text-gray-100">설정</h2>
      <AccountCard email={email} />
      <PasswordCard />
      <DeleteAccountCard email={email} />
    </section>
  )
}

function AccountCard({ email }) {
  return (
    <section aria-label="계정 정보" className={cardClass}>
      <h3 className="text-base font-semibold text-white">계정</h3>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">로그인한 이메일</span>
        <p className="break-all text-sm text-gray-100">{email || '-'}</p>
      </div>
    </section>
  )
}

function PasswordCard() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (password.length < 6) return toast.error('비밀번호는 6자 이상이어야 합니다')
    if (password !== confirm) return toast.error('새 비밀번호가 서로 일치하지 않습니다')
    setIsBusy(true)
    try {
      await updatePassword(password)
      setPassword('')
      setConfirm('')
      toast('비밀번호가 변경되었습니다')
    } catch (error) {
      toast.error(describeAuthError(error))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="비밀번호 변경" className={cardClass}>
      <h3 className="text-base font-semibold text-white">비밀번호 변경</h3>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        새 비밀번호
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        새 비밀번호 확인
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="한 번 더 입력" className={inputClass} />
      </label>
      <button type="submit" disabled={isBusy || !password} className="w-fit rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-[white] transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">
        {isBusy ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  )
}

function DeleteAccountCard({ email }) {
  const [typed, setTyped] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const canDelete = Boolean(email) && typed.trim() === email

  const handleDelete = async () => {
    if (!canDelete || isBusy) return
    if (!window.confirm('정말 삭제하시겠습니까? 계정과 모든 데이터가 영구 삭제되며 되돌릴 수 없습니다.')) return
    setIsBusy(true)
    try {
      await deleteMyAccount()
      toast('계정이 삭제되었습니다')
    } catch {
      toast.error('계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요')
      setIsBusy(false)
    }
  }

  return (
    <section aria-label="계정 삭제" className={`${cardClass} border border-red-500/30`}>
      <h3 className="text-base font-semibold text-red-400">계정 삭제</h3>
      <p className="text-sm text-gray-400">
        계정과 함께 업무·취미·투자·일정과 페이지 본문까지 모든 데이터가 영구 삭제되며 되돌릴 수 없습니다.
        외부 가입을 막아 두었다면 삭제 후에는 다시 가입할 수 없으니 주의하세요.
      </p>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        확인을 위해 내 이메일을 그대로 입력하세요
        <input type="email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} className={inputClass} />
      </label>
      <button
        type="button"
        onClick={handleDelete}
        disabled={!canDelete || isBusy}
        className="w-fit rounded-lg border border-red-500/50 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isBusy ? '삭제 중...' : '계정 영구 삭제'}
      </button>
    </section>
  )
}
