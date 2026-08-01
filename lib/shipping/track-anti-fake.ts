import { CARRIERS, findCarrierById, type Carrier } from "@/lib/shipping/carriers"

const CARRIER_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "fr_colissimo", re: /^\d{13}$|^[A-Z]{2}\d{9}[A-Z]{2}$/i },
  { id: "us_ups", re: /^1Z[A-Z0-9]{16}$/i },
  { id: "us_fedex", re: /^\d{12,20}$/ },
  { id: "us_usps", re: /^\d{20,22}$|^[A-Z]{2}\d{9}[A-Z]{2}$/i },
  { id: "de_dhl", re: /^\d{10,20}$/ },
]

export function normalizeTrackingCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase()
}

export function isValidTrackingFormat(code: string): boolean {
  if (code.length < 8 || code.length > 40) return false
  return /^[A-Z0-9-]+$/i.test(code)
}

export function detectCarrierId(code: string, hint?: string | null): string | null {
  const hinted = hint?.trim()
  if (hinted && findCarrierById(hinted)) return hinted

  for (const row of CARRIER_PATTERNS) {
    if (row.re.test(code)) return row.id
  }
  return null
}

/**
 * Heuristic anti-fake score — 0 clean → 100 highly suspicious.
 */
export function computeCrackingScore(code: string): number {
  let score = 0
  if (!isValidTrackingFormat(code)) score += 50
  if (/FAKE|TEST|DUMMY|SAMPLE/i.test(code)) score += 100
  if (code.length < 10) score += 30
  if (/^(123|000|999)/.test(code)) score += 40
  return Math.min(100, score)
}

export type TrackLookupResult = {
  tracking: string
  detectedCarrier: Carrier | null
  isValidFormat: boolean
  crackingScore: number
  isFake: boolean
  realStatus: string | null
  mode: "live" | "mock"
  links: {
    official: string
    google: string
    carrier: string | null
  }
}

export async function lookupTracking(args: {
  code: string
  carrierHint?: string | null
  trackingMoreApiKey?: string | null
}): Promise<TrackLookupResult> {
  const tracking = normalizeTrackingCode(args.code)
  const isValidFormat = isValidTrackingFormat(tracking)
  const crackingScore = computeCrackingScore(tracking)
  const isFake = crackingScore > 70
  const detectedId = detectCarrierId(tracking, args.carrierHint)
  const detectedCarrier = detectedId ? findCarrierById(detectedId) : null

  let realStatus: string | null = null
  let mode: "live" | "mock" = "mock"

  const apiKey = args.trackingMoreApiKey?.trim()
  if (apiKey && isValidFormat && !isFake) {
    try {
      const url = new URL("https://api.trackingmore.com/v4/trackings/get")
      url.searchParams.set("tracking_numbers", tracking)
      const res = await fetch(url.toString(), {
        headers: {
          "Tracking-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      })
      if (res.ok) {
        const body = (await res.json()) as {
          data?: Array<{ delivery_status?: string; status?: string }>
        }
        const row = body.data?.[0]
        realStatus = row?.delivery_status ?? row?.status ?? "in_transit"
        mode = "live"
      } else {
        console.warn("[shipping-track]", {
          result: "trackingmore_http",
          status: res.status,
        })
      }
    } catch (err) {
      console.error("[shipping-track]", {
        result: "trackingmore_error",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (!realStatus) {
    realStatus = isFake ? "suspect" : isValidFormat ? "pending_lookup" : "invalid_format"
  }

  const carrierUrl = detectedCarrier
    ? detectedCarrier.tracking_url.replaceAll("{tracking}", encodeURIComponent(tracking))
    : null

  return {
    tracking,
    detectedCarrier,
    isValidFormat,
    crackingScore,
    isFake,
    realStatus,
    mode,
    links: {
      official: `https://parcelsapp.com/en/tracking/${encodeURIComponent(tracking)}`,
      google: `https://www.google.com/search?q=${encodeURIComponent(`${tracking} tracking`)}`,
      carrier: carrierUrl,
    },
  }
}

/** Expose carrier count for smoke tests. */
export function carriersCatalogSize(): number {
  return CARRIERS.length
}
