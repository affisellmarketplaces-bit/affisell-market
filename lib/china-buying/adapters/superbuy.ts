export type ChinaBuyAdapterResult =
  | { ok: true; status: "API_OK"; externalRef: string }
  | { ok: true; status: "STUB"; message: string }
  | { ok: false; status: "API_FAIL"; error: string }

/**
 * Superbuy API adapter — stub when SUPERBUY_API_KEY is unset.
 * Real integration: POST item URL to Superbuy cart API.
 */
export async function routeSuperbuyItem(args: {
  sourceUrl: string
  platform: string | null
  quantity: number
}): Promise<ChinaBuyAdapterResult> {
  const apiKey = process.env.SUPERBUY_API_KEY?.trim()
  if (!apiKey) {
    return {
      ok: true,
      status: "STUB",
      message: "SUPERBUY_API_KEY not configured — manual routing logged",
    }
  }

  try {
    const res = await fetch("https://api.superbuy.com/v1/items/route", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: args.sourceUrl,
        platform: args.platform,
        quantity: args.quantity,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      orderId?: string
      message?: string
    }
    if (!res.ok) {
      return {
        ok: false,
        status: "API_FAIL",
        error: json.message ?? `superbuy_${res.status}`,
      }
    }
    return {
      ok: true,
      status: "API_OK",
      externalRef: json.orderId ?? `superbuy_${Date.now()}`,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, status: "API_FAIL", error: message }
  }
}
