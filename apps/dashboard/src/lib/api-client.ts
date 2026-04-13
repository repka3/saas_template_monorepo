const rawApiBaseUrl = import.meta.env.VITE_API_URL?.trim()
if (!rawApiBaseUrl && import.meta.env.PROD) {
  throw new Error('VITE_API_URL is required in production builds. Set it to your backend URL (e.g. https://api.example.com).')
}
const apiBaseUrl = (rawApiBaseUrl || 'http://localhost:3005').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string
  details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    ...init,
  })

  if (!res.ok) {
    let code = 'unknown_error'
    let message = `Request failed (${res.status})`
    let details: Record<string, unknown> | undefined

    try {
      const body = await res.json()
      if (body?.error) {
        code = body.error.code ?? code
        message = body.error.message ?? message
        details = body.error.details
      }
    } catch {
      // response body wasn't JSON — keep defaults
    }

    throw new ApiError(res.status, code, message, details)
  }

  return res.json() as Promise<T>
}

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i

// Avatar values are stored as browser-facing public paths, not API-relative asset keys.
// By default, `/uploads/...` is served from the same origin as the dashboard, and
// local development mirrors that with the Vite proxy.
export function normalizePublicAssetUrl(path: string | null | undefined): string | undefined {
  const trimmedPath = path?.trim()

  if (!trimmedPath) return undefined
  if (ABSOLUTE_URL_PATTERN.test(trimmedPath)) return trimmedPath
  if (trimmedPath.startsWith('/')) return trimmedPath

  return trimmedPath
}
