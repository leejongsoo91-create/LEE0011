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
// 무료 Zapier의 Code 단계는 1초 안에 끝나야 한다. 그래서 0.8초까지만 응답을 기다리고,
// 더 걸리면 "보냄"으로 끝낸다. 같은 녹음이 다시 와도 대시보드가 한 번만 받으므로 안전하다.

const send = fetch('https://lee-0011.vercel.app/api/plaud-hook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-plaud-secret': inputData.secret },
  body: JSON.stringify({ title: inputData.title, summary: inputData.summary, created_at: inputData.created_at }),
}).then(async (response) => ({ status: response.status, body: await response.text() }))

const waitLimit = new Promise((resolve) => setTimeout(() => resolve({ status: 'sent', body: '0.8초 안에 응답이 없어 기다리지 않음' }), 800))

return await Promise.race([send, waitLimit])
