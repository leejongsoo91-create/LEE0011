// Zapier "Code by Zapier → Run Javascript" 단계에 그대로 붙여 넣는 코드. (이 파일은 저장소 보관용, 배포되지 않음)
//
// Zap 구성: ① Plaud "Transcript & Summary Ready" (최소 길이 1분, Markdown) → ② Code by Zapier "Run Javascript"
// ② 단계의 Input Data에 4줄을 만든다:
//   title      ← ① 단계의 Title
//   summary    ← ① 단계의 Summary
//   created_at ← ① 단계의 Create Time
//   secret     ← Vercel의 PLAUD_HOOK_SECRET과 같은 값 (직접 입력)
// Transcript(녹취록)는 넣지 않는다. 요약만 보낸다.
//
// 무료 Zapier의 Code 단계는 1초 안에 끝나야 한다. 그래서 0.8초까지만 응답을 기다린다.
// 0.8초 안에 200을 못 받으면(늦음·거절·연결 실패) 오류를 낸다 → Zap 기록이 "실패"로 남고 Zapier가 메일로 알린다.
//   예전에는 늦으면 "보냄"(성공)으로 끝내서, 녹음이 대시보드에 닿지 않아도 알 수 없었다.
//   실패한 기록은 Zap history에서 다시 실행(Replay)하면 된다. 같은 녹음은 대시보드가 한 번만 받으므로 다시 보내도 안전하다.
//   무료 요금제에서 Replay 버튼이 없으면: Plaud 앱에서 그 녹음의 요약을 다시 만들어(재요약) Zap을 다시 돌린다.
//   실패가 계속되면 Zapier가 Zap을 자동으로 끌 수 있으니, 실패 메일을 받으면 Zap이 On인지도 본다.
// 성공하면 Data Out에 status(200)·result(queued/duplicate)·ms(걸린 시간)를 남긴다. ms가 800에 가까우면 알려 주세요.

const LIMIT_MS = 800
const started = Date.now()

// 끝난 뒤 타이머·요청이 남아 있으면 Zapier가 그만큼 더 기다리므로, 답이 정해지면 둘 다 정리한다.
// 이미 서버에 닿은 요청은 끊어도 서버에서 그대로 처리된다(같은 녹음은 한 번만 들어가 안전).
const controller = new AbortController()
let timer

const send = fetch('https://lee-0011.vercel.app/api/plaud-hook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-plaud-secret': inputData.secret },
  body: JSON.stringify({ title: inputData.title, summary: inputData.summary, created_at: inputData.created_at }),
  signal: controller.signal,
}).then(async (response) => ({ status: response.status, body: await response.text() }))

const timeout = new Promise((resolve) => {
  timer = setTimeout(() => resolve({ status: 'timeout', body: '' }), LIMIT_MS)
})

const answer = await Promise.race([send.catch(() => ({ status: 'network-error', body: '' })), timeout])
clearTimeout(timer)
controller.abort()
const ms = Date.now() - started

if (answer.status !== 200) {
  // 401: Zapier의 secret이 Vercel 값과 다름 · 503: Vercel에 PLAUD_HOOK_SECRET 없음 · 500: 받은함 저장 실패(SQL 확인)
  // timeout: 0.8초 안에 응답 없음 → Replay로 다시 보내기
  throw new Error(`대시보드가 받지 못했어요: ${answer.status} (${ms}ms) ${String(answer.body).slice(0, 80)}`)
}

let result = ''
try {
  result = JSON.parse(answer.body).status ?? ''
} catch {
  result = ''
}
return { status: 200, result, ms }
