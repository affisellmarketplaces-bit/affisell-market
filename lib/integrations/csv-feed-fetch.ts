import "server-only"

import { assertSafeOutboundUrl } from "@/lib/safe-outbound-url"
import { parseCsvText, rowsToObjects } from "@/lib/supplier-csv-import"
import { CSV_FEED_FETCH_TIMEOUT_MS, CSV_FEED_MAX_BYTES } from "@/lib/integrations/csv-feed-config"

export class CsvFeedFetchError extends Error {
  code: "blocked_url" | "fetch_failed" | "too_large" | "empty" | "parse_failed"
  constructor(code: CsvFeedFetchError["code"], message: string) {
    super(message)
    this.code = code
    this.name = "CsvFeedFetchError"
  }
}

/** Fetches and parses a public CSV/Google-Sheet feed URL — SSRF-guarded, size-capped. */
export async function fetchCsvFeedRows(
  feedUrl: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const safe = assertSafeOutboundUrl(feedUrl)
  if (!safe.ok) {
    throw new CsvFeedFetchError("blocked_url", safe.error)
  }

  let res: Response
  try {
    res = await fetch(safe.url.toString(), {
      signal: AbortSignal.timeout(CSV_FEED_FETCH_TIMEOUT_MS),
      headers: { Accept: "text/csv, text/plain, */*" },
      cache: "no-store",
      redirect: "follow",
    })
  } catch (err) {
    throw new CsvFeedFetchError(
      "fetch_failed",
      err instanceof Error ? err.message : "Feed request failed"
    )
  }

  if (!res.ok) {
    throw new CsvFeedFetchError("fetch_failed", `Feed responded with HTTP ${res.status}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) {
    throw new CsvFeedFetchError("empty", "Feed returned no content")
  }
  if (buf.length > CSV_FEED_MAX_BYTES) {
    throw new CsvFeedFetchError(
      "too_large",
      `Feed is ${(buf.length / 1024 / 1024).toFixed(1)} MB — the limit is ${CSV_FEED_MAX_BYTES / 1024 / 1024} MB`
    )
  }

  const text = buf.toString("utf8")
  const { headers, rows } = parseCsvText(text)
  if (headers.length === 0) {
    throw new CsvFeedFetchError("parse_failed", "Could not find a header row in this feed")
  }

  return { headers, rows: rowsToObjects(headers, rows) }
}
