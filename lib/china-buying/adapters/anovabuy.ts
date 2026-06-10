import type { ChinaBuyAdapterResult } from "@/lib/china-buying/adapters/superbuy"

/**
 * Anovabuy API adapter — stub when ANOVABUY_API_KEY is unset.
 */
export async function routeAnovabuyItem(args: {
  sourceUrl: string
  platform: string | null
  quantity: number
}): Promise<ChinaBuyAdapterResult> {
  const apiKey = process.env.ANOVABUY_API_KEY?.trim()
  if (!apiKey) {
    return {
      ok: true,
      status: "STUB",
      message: "ANOVABUY_API_KEY not configured — manual routing logged",
    }
  }

  try {
    const res = await fetch("https://api.anovabuy.com/v1/purchase/route", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_url: args.sourceUrl,
        platform: args.platform,
        qty: args.quantity,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      ref?: string
      error?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        status: "API_FAIL",
        error: json.error ?? `anovabuy_${res.status}`,
      }
    }
    return {
      ok: true,
      status: "API_OK",
      externalRef: json.ref ?? `anovabuy_${Date.now()}`,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, status: "API_FAIL", error: message }
  }
}
