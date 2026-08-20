import { DEFAULT_SHOPIFY_API_VERSION } from "@/lib/shopify-sync-map"

export async function shopifyAdminFetchJson(args: {
  shopHost: string
  accessToken: string
  apiVersion?: string
  path: string
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
}): Promise<
  | { ok: true; status: number; json: unknown }
  | { ok: false; status: number; message: string }
> {
  const v = args.apiVersion?.trim() || DEFAULT_SHOPIFY_API_VERSION
  const path = args.path.replace(/^\//, "")
  const url = `https://${args.shopHost}/admin/api/${v}/${path}`
  const method = args.method ?? "GET"
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        "X-Shopify-Access-Token": args.accessToken,
        Accept: "application/json",
        ...(args.body != null ? { "Content-Type": "application/json" } : {}),
      },
      body: args.body != null ? JSON.stringify(args.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(28_000),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Shopify request failed"
    return { ok: false, status: 0, message: msg }
  }

  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    if (method === "DELETE" && res.ok) {
      return { ok: true, status: res.status, json: {} }
    }
    return {
      ok: false,
      status: res.status,
      message: text.slice(0, 240) || "Invalid JSON from Shopify",
    }
  }

  if (!res.ok) {
    const o = json as Record<string, unknown>
    const errs = o.errors
    const first =
      Array.isArray(errs) && errs.length
        ? String(errs[0])
        : typeof o.message === "string"
          ? o.message
          : text.slice(0, 240)
    return { ok: false, status: res.status, message: first || `HTTP ${res.status}` }
  }

  return { ok: true, status: res.status, json }
}
