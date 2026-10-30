// 에이전트 프로그램 매칭 저장소 (agent_settings 표, 항상 한 줄). 텔레그램 결재(agents.set_matching)로만 바뀐다.
// 읽기에 실패하면 빈 설정을 돌려줘서 Vercel 환경변수 기본값으로 동작한다. (설정 때문에 에이전트가 멈추지 않게)

import { rest } from './supabase.js'

// 고를 수 있는 프로그램과 모델 (오타·엉뚱한 값을 결재 요청 전에 막는 허용 목록)
export const ALLOWED_PROGRAMS = {
  main: ['anthropic', 'test'],
  crosscheck: ['off', 'test', 'anthropic'],
}
export const ALLOWED_MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5']
export const ROLES = Object.keys(ALLOWED_PROGRAMS)

const COLUMNS = 'main_program,main_model,crosscheck_program,crosscheck_model'
const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)

// 저장된 값. { main: {program, model}, crosscheck: {program, model} } (없는 칸은 null)
export const toSettings = (row) => ({
  main: { program: clean(row?.main_program), model: clean(row?.main_model) },
  crosscheck: { program: clean(row?.crosscheck_program), model: clean(row?.crosscheck_model) },
})

// 저장된 값을 그대로 읽는다. 실패하면 오류를 던진다 (원복할 이전 값을 잘못 잡지 않으려고 쓰기 도구는 이쪽을 쓴다)
export async function readSettings() {
  const rows = await rest(`agent_settings?select=${COLUMNS}&id=eq.1`)
  return toSettings(rows?.[0])
}

// 계획·상의에 쓰는 읽기: 실패하면 빈 설정(환경변수 기본값)으로 넘어간다
export async function loadSettings() {
  try {
    return await readSettings()
  } catch (error) {
    console.error('[agents] 매칭 설정을 읽지 못해 환경변수 기본값을 씁니다', String(error?.message ?? error))
    return toSettings(null)
  }
}

// 한 역할의 저장값을 바꾼다 (다른 역할 칸은 그대로). 읽기와 달리 실패하면 오류를 던진다 → 실행기가 원복·보고한다.
export async function saveSetting(role, { program, model }) {
  if (!ROLES.includes(role)) throw new Error(`모르는 역할: ${role}`)
  const rows = await rest('agent_settings?on_conflict=id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: { id: 1, [`${role}_program`]: program ?? null, [`${role}_model`]: model ?? null, updated_at: new Date().toISOString() },
  })
  if (!rows?.[0]) throw new Error('매칭 저장 결과를 받지 못했습니다')
  return toSettings(rows[0])[role]
}
