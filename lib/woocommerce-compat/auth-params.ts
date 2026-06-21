import { z } from "zod"

const scopeSchema = z.enum(["read", "write", "read_write"])

const paramsSchema = z.object({
  app_name: z.string().min(1),
  scope: scopeSchema,
  user_id: z.string().min(1),
  return_url: z.string().url(),
  callback_url: z.string().url(),
})

export type WooCommerceAuthParams = z.infer<typeof paramsSchema>

export type WooCommerceAuthParamsResult =
  | { ok: true; params: WooCommerceAuthParams }
  | { ok: false; error: string }

function validateCallbackUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return "invalid_callback_url"
  }
  if (parsed.protocol !== "https:") return "callback_must_be_https"
  if (parsed.port && parsed.port !== "443") return "callback_must_not_include_port"
  if (parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost")) {
    return "callback_localhost_not_allowed"
  }
  return null
}

export function parseWooCommerceAuthParams(
  searchParams: URLSearchParams
): WooCommerceAuthParamsResult {
  const raw = {
    app_name: searchParams.get("app_name")?.trim() ?? "",
    scope: searchParams.get("scope")?.trim() ?? "",
    user_id: searchParams.get("user_id")?.trim() ?? "",
    return_url: searchParams.get("return_url")?.trim() ?? "",
    callback_url: searchParams.get("callback_url")?.trim() ?? "",
  }

  const parsed = paramsSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: "invalid_auth_params" }
  }

  const callbackError = validateCallbackUrl(parsed.data.callback_url)
  if (callbackError) {
    return { ok: false, error: callbackError }
  }

  try {
    new URL(parsed.data.return_url)
  } catch {
    return { ok: false, error: "invalid_return_url" }
  }

  return { ok: true, params: parsed.data }
}

export function buildWooCommerceAuthQuery(params: WooCommerceAuthParams): string {
  const q = new URLSearchParams({
    app_name: params.app_name,
    scope: params.scope,
    user_id: params.user_id,
    return_url: params.return_url,
    callback_url: params.callback_url,
  })
  return q.toString()
}
