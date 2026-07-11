export const INSTANTSCAN_FETCH_TIMEOUT_MS = 45_000
export const INSTANTSCAN_MAX_RETRY_ATTEMPTS = 3

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
}

export type InstantScanFetchResult = {
  ok: boolean
  status: number
  data: InstantScanAnalyzeResponse
}

export type AnalyzeWithRetryOptions = {
  signal?: AbortSignal
  onRetry?: (attempt: number, status: number) => void
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
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
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err
    return {
      ok: false,
      status: 0,
      data: { error: "network_error" },
    }
  }
}

/** Retry 429/500 with backoff 1s / 2s / 4s (max 3 retries). */
export async function analyzeWithRetry(
  imageUrl: string,
  attempt = 0,
  options?: AnalyzeWithRetryOptions
): Promise<InstantScanFetchResult> {
  if (options?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError")
  }

  const result = await fetchInstantScanAnalyze(imageUrl, options)
  if (result.ok || !isRetryableStatus(result.status)) return result

  if (attempt >= INSTANTSCAN_MAX_RETRY_ATTEMPTS) {
    throw new Error("instantscan_rate_limit")
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
