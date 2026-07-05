/**
 * Thin fetch wrapper around the pktflow-web backend API.
 * Every request is prefixed with {@link API_BASE}; the frontend talks only to
 * the backend, which forwards per-port operations to the selected daemon.
 * Every non-2xx response carries a `{ "error": "..." }` body, which is
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

/** Extracts the backend's `{error}` message, falling back to the status line. */
async function toApiError(res: Response): Promise<ApiError> {
  let message = `${res.status} ${res.statusText}`
  try {
    const body: unknown = await res.json()
    if (
      body !== null &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
    ) {
      message = (body as { error: string }).error
    }
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

/** Performs a request expecting the backend's `{ ok: true }` acknowledgement. */
export async function apiAck(path: string, options: RequestOptions = {}): Promise<void> {
  await apiFetch<{ ok: true }>(path, options)
}

/** Performs a request whose success carries no body (e.g. a 204 response). */
export async function apiVoid(path: string, options: RequestOptions = {}): Promise<void> {
  await request(path, options)
}

/** Fetches a binary body (used for pcap downloads). */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    throw await toApiError(res)
  }
  return res.blob()
}
