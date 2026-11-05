/**
 * The only place that knows how to talk to the backend.
 * Every feature calls these helpers instead of using fetch directly.
 */
import type { ApiErrorBody } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch (error) {
    if (init?.signal?.aborted) throw error
    throw new ApiError(0, {
      code: 'network_error',
      detail: 'The server could not be reached. Check your connection and try again.',
    })
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, isErrorBody(body) ? body : unexpectedError(response.status))
  }
  return body as T
}

/** Normalises anything thrown by a request into the API's error shape. */
export function toErrorBody(error: unknown): ApiErrorBody {
  return error instanceof ApiError ? error.body : unexpectedError(0)
}

export const apiGet = <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal })

export const apiPost = <T>(path: string, payload: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(payload), signal })

function isErrorBody(body: unknown): body is ApiErrorBody {
  return typeof body === 'object' && body !== null && 'code' in body && 'detail' in body
}

function unexpectedError(status: number): ApiErrorBody {
  // A non-JSON 5xx usually means the backend is down behind a proxy.
  if (status >= 500) {
    return {
      code: 'server_error',
      detail: 'The server could not complete the request. Try again in a moment.',
    }
  }
  return { code: 'unexpected', detail: `Unexpected server response (${status || 'no status'}).` }
}
