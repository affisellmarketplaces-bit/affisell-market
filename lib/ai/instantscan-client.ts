export const INSTANTSCAN_FETCH_TIMEOUT_MS = 60_000
export const INSTANTSCAN_MAX_RETRY_ATTEMPTS = 2

export type InstantScanAnalyzeResponse = {
  title?: string
  description?: string
  categoryId?: string | null
  suggestedPrice?: number | null
  confidence?: number
  detectedModel?: string | null
  visionVersion?: string
  instantScanStage?: "embed" | "mini" | "gpt4o" | "groq"
  latencyMs?: number
  error?: string
  fallback?: string
  retry_after_sec?: number
}

export type InstantScanFetchResult = {
  ok: boolean
  status: number
  data: InstantScanAnalyzeResponse
  retryAfterSec?: number
}

export type AnalyzeWithRetryOptions = {
  signal?: AbortSignal
  onRetry?: (attempt: number, status: number) => void
}

function isTransientServerError(status: number): boolean {
  return status >= 500 && status !== 501
}

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      },
      { once: true }
    )
  })
}

function parseRetryAfterSec(res: Response, data: InstantScanAnalyzeResponse): number | undefined {
  const header = res.headers.get("Retry-After")
  const fromHeader = header ? Number(header) : NaN
  if (Number.isFinite(fromHeader) && fromHeader > 0) return Math.round(fromHeader)
  if (typeof data.retry_after_sec === "number" && data.retry_after_sec > 0) {
    return data.retry_after_sec
  }
  return undefined
}

export async function fetchInstantScanAnalyze(
  imageUrl: string,
  options?: { signal?: AbortSignal }
): Promise<InstantScanFetchResult> {
  try {
    const res = await fetch("/api/ai/analyze-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ imageUrl }),
      signal: options?.signal,
    })
    const data = (await res.json()) as InstantScanAnalyzeResponse
    const retryAfterSec = res.status === 429 ? parseRetryAfterSec(res, data) : undefined
    return { ok: res.ok, status: res.status, data, retryAfterSec }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err
    return {
      ok: false,
      status: 0,
      data: { error: "network_error" },
    }
  }
}

/**
 * Retry transient 5xx only — never hammers 429 (rate limit has its own cooldown UI).
 */
export async function analyzeWithRetry(
  imageUrl: string,
  attempt = 0,
  options?: AnalyzeWithRetryOptions
): Promise<InstantScanFetchResult> {
  if (options?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError")
  }

  const result = await fetchInstantScanAnalyze(imageUrl, options)

  if (result.status === 429) {
    return {
      ...result,
      data: { ...result.data, error: "rate_limit" },
    }
  }

  if (result.ok || !isTransientServerError(result.status)) return result

  if (attempt >= INSTANTSCAN_MAX_RETRY_ATTEMPTS) {
    return result
  }

  options?.onRetry?.(attempt + 1, result.status)
  await sleepMs(1000 * 2 ** attempt, options?.signal)
  return analyzeWithRetry(imageUrl, attempt + 1, options)
}

/** @deprecated use analyzeWithRetry */
export const fetchInstantScanAnalyzeWithRetry = (
  imageUrl: string,
  options?: AnalyzeWithRetryOptions
) => analyzeWithRetry(imageUrl, 0, options)
