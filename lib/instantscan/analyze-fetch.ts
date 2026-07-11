export const INSTANTSCAN_FETCH_TIMEOUT_MS = 45_000
export const INSTANTSCAN_RETRY_BACKOFF_MS = [1000, 2000, 4000] as const

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

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

export async function fetchInstantScanAnalyze(
  imageUrl: string,
  options?: { signal?: AbortSignal }
): Promise<InstantScanFetchResult> {
  const res = await fetch("/api/ai/analyze-product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ imageUrl }),
    signal: options?.signal,
  })
  const data = (await res.json()) as InstantScanAnalyzeResponse
  return { ok: res.ok, status: res.status, data }
}

export async function fetchInstantScanAnalyzeWithRetry(
  imageUrl: string,
  options?: { signal?: AbortSignal }
): Promise<InstantScanFetchResult> {
  let last: InstantScanFetchResult | null = null

  for (let attempt = 0; attempt <= INSTANTSCAN_RETRY_BACKOFF_MS.length; attempt++) {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }

    last = await fetchInstantScanAnalyze(imageUrl, options)
    if (last.ok || !isRetryableStatus(last.status)) return last

    const delay = INSTANTSCAN_RETRY_BACKOFF_MS[attempt]
    if (delay == null) break

    await new Promise<void>((resolve, reject) => {
      const timer = globalThis.setTimeout(resolve, delay)
      options?.signal?.addEventListener(
        "abort",
        () => {
          globalThis.clearTimeout(timer)
          reject(new DOMException("Aborted", "AbortError"))
        },
        { once: true }
      )
    })
  }

  return last ?? { ok: false, status: 500, data: { error: "analyze_failed" } }
}
