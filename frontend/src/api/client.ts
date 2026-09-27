/**
 * Thin fetch wrapper around the pktflow-web backend API.
 * Every request is prefixed with {@link API_BASE}; the frontend talks only to
 * the backend, which forwards OTG calls to the selected daemon.
 * Non-2xx responses carry either the backend's own `{ "error": "..." }` body or
 * the daemon's OTG `{ "code", "kind", "errors": [...] }` body; both are
 * surfaced as an {@link ApiError} rather than being swallowed.
 */

/**
 * Base path of the backend API. In dev the Vite server proxies `/api` to the
 * backend; in production the backend serves the UI from the same origin.
 */
export const API_BASE = '/api'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

/** Extracts a human-readable message from a backend or OTG error body. */
function errorBodyMessage(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined
  if (typeof body.error === 'string') return body.error
  if (Array.isArray(body.errors)) {
    const messages = body.errors.filter((e): e is string => typeof e === 'string')
    if (messages.length > 0) return messages.join('; ')
  }
  return undefined
}

/** Builds an {@link ApiError}, falling back to the status line for unknown bodies. */
async function toApiError(res: Response): Promise<ApiError> {
  let message = `${res.status} ${res.statusText}`
  try {
    message = errorBodyMessage(await res.json()) ?? message
  } catch {
    // Non-JSON body (e.g. a proxy failure); keep the status-line message.
  }
  return new ApiError(message, res.status)
}

interface RequestOptions {
  method?: string
  /** JSON-serialized into the request body. */
  body?: unknown
}

/** Issues a request and returns the raw response, throwing on non-2xx. */
async function request(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body } = options
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    throw await toApiError(res)
  }
  return res
}

/** Performs a request and parses the JSON response as `T`. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await request(path, options)
  return res.json() as Promise<T>
}

/** Performs a request whose success carries no body (e.g. a 204 response). */
export async function apiVoid(path: string, options: RequestOptions = {}): Promise<void> {
  await request(path, options)
}

/** Performs a request and returns the binary body (used for pcap downloads). */
export async function apiBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const res = await request(path, options)
  return res.blob()
}
