/**
 * The only place that knows how to talk to the backend.
 * Every feature calls these helpers instead of using fetch directly.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  })

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(response.status, body, `Request to ${path} failed (${response.status})`)
  }
  return body as T
}

export const apiGet = <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal })

export const apiPost = <T>(path: string, payload: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(payload), signal })
