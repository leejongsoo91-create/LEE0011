// 서비스 롤 키로 Supabase REST(PostgREST)를 부르는 얇은 도우미.
// 서비스 롤 키는 RLS를 우회하므로, 호출하는 쪽에서 항상 id·현재 상태 조건을 함께 건다.

function config() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('supabase-not-configured')
  return { url: url.replace(/\/$/, ''), key }
}

export async function rest(path, { method = 'GET', body, prefer } = {}) {
  const { url, key } = config()
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`supabase-${response.status}`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}
