import "server-only"

import { ECB_HIST_90D_URL, parseEcbHistXml, type FxDay } from "@/lib/strategic-intelligence/external/ecb-fx"

const MAX_BYTES = 2_000_000

/**
 * Downloads the ECB 90-day reference rates (fixed official URL, no key, no user input). Cached 6 h by Next's fetch
 * cache; 8 s timeout; size capped. Throws on any failure so the cockpit reports the source as not verified this run.
 */
export async function fetchEcbHist90d(): Promise<FxDay[]> {
  const res = await fetch(ECB_HIST_90D_URL, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 21_600 },
    headers: { accept: "application/xml,text/xml" },
  })
  if (!res.ok) throw new Error(`ecb_http_${res.status}`)
  const text = await res.text()
  if (text.length > MAX_BYTES) throw new Error("ecb_too_large")
  const days = parseEcbHistXml(text)
  if (days.length === 0) throw new Error("ecb_unparseable")
  return days
}
