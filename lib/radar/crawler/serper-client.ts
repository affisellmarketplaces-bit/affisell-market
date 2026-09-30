import "server-only"

import { radarFetch } from "@/lib/radar/crawler/http"

export function getSerperApiKey(): string | null {
  return process.env.SERPER_API_KEY?.trim() || null
}

/** Health / UI: `serper: !!SERPER_API_KEY` */
export function isSerperConfigured(): boolean {
  return Boolean(getSerperApiKey())
}

/**
 * Distinguishes Serper quota/credit exhaustion from generic HTTP errors. Plain `http_error`
 * logging made this indistinguishable from a transient failure — it ran silently degraded for
 * weeks (walmart/etsy/aliexpress/temu/mercadolibre never crawled a single row) before anyone
 * noticed, because nothing ever threw or surfaced differently from a one-off network blip.
 */
export async function readSerperErrorDetail(
  res: Response
): Promise<{ status: number; quotaExhausted: boolean; message: string }> {
  const bodyText = await res.text().catch(() => "")
  const quotaExhausted = /not enough credit|insufficient credit|out of credit|quota exceeded/i.test(
    bodyText
  )
  return { status: res.status, quotaExhausted, message: bodyText.slice(0, 300) }
}

export type SerperSearchOptions = {
  gl?: string
  /** Override endpoint (default google.serper.dev/search). */
  url?: string
}

/**
 * Serper Google search. Missing SERPER_API_KEY → warn + [] (never throws for config).
 * Google Trends / multi-source crawl stay degraded-OK without this key.
 */
export async function serperSearch(
  query: string,
  options: SerperSearchOptions = {}
): Promise<Record<string, unknown>[]> {
  const key = getSerperApiKey()
  if (!key) {
    console.warn("[radar/serper]", {
      result: "skipped",
      reason: "SERPER_API_KEY_missing",
      message: "Trends/Serper source skipped — TikTok+Amazon+DB continue",
    })
    return []
  }

  const q = query.trim()
  if (!q) return []

  try {
    const res = await radarFetch(options.url ?? "https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify({
        q,
        gl: options.gl ?? "us",
      }),
    })

    if (!res.ok) {
      const detail = await readSerperErrorDetail(res)
      console.warn("[radar/serper]", {
        result: detail.quotaExhausted ? "quota_exhausted" : "http_error",
        status: detail.status,
        message: detail.message,
      })
      return []
    }

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!json) return []

    const organic = Array.isArray(json.organic) ? (json.organic as Record<string, unknown>[]) : []
    const related = Array.isArray(json.relatedSearches)
      ? (json.relatedSearches as Record<string, unknown>[])
      : Array.isArray(json.related_searches)
        ? (json.related_searches as Record<string, unknown>[])
        : []

    const rows = [...organic, ...related]
    console.log("[radar/serper]", { result: "ok", count: rows.length })
    // Attach raw payload as first synthetic row when structured lists empty but body present
    if (rows.length === 0) {
      return [json]
    }
    return rows
  } catch (err) {
    console.warn("[radar/serper]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return []
  }
}

/** Full JSON body for parsers that need related_searches / trends shape. */
export async function serperSearchRaw(
  query: string,
  options: SerperSearchOptions = {}
): Promise<Record<string, unknown> | null> {
  const key = getSerperApiKey()
  if (!key) {
    console.warn("[radar/serper]", {
      result: "skipped",
      reason: "SERPER_API_KEY_missing",
    })
    return null
  }

  const q = query.trim()
  if (!q) return null

  try {
    const res = await radarFetch(options.url ?? "https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify({
        q,
        gl: options.gl ?? "us",
      }),
    })
    if (!res.ok) {
      const detail = await readSerperErrorDetail(res)
      console.warn("[radar/serper]", {
        result: detail.quotaExhausted ? "quota_exhausted" : "http_error",
        status: detail.status,
        message: detail.message,
      })
      return null
    }
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return json
  } catch (err) {
    console.warn("[radar/serper]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return null
  }
}
