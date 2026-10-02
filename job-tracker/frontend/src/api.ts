async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch('/api' + url, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!r.ok) throw new Error(await r.text())
  return (r.status === 204 ? undefined : await r.json()) as T
}
const body = (method: string, b?: unknown): RequestInit => ({ method, body: JSON.stringify(b) })

export const api = {
  get: <T,>(u: string) => call<T>(u),
  post: <T,>(u: string, b?: unknown) => call<T>(u, body('POST', b)),
  put: <T,>(u: string, b?: unknown) => call<T>(u, body('PUT', b)),
  del: (u: string) => call<void>(u, { method: 'DELETE' }),
}
