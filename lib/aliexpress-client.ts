import "server-only"

import { readAliExpressConfig } from "@/lib/aliexpress-config"
import { getValidAccessToken } from "@/lib/aliexpress-oauth"
import {
  AliExpressApiError,
  AliExpressClient,
  createAliExpressClient as createLegacyClient,
  encodeAliExpressQuery,
  getAliExpressTimestampMs,
  signAliExpressIopHmacSha256,
  unwrapAliExpressMethodResponse,
} from "@/lib/aliexpress-open-api"

export { getValidAccessToken, forceRefreshAndPersistAliExpressTokens } from "@/lib/aliexpress-oauth"
export { AliExpressApiError, AliExpressClient }

const REQUEST_TIMEOUT_MS = 15_000

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function restHost(sandbox: boolean): string {
  return sandbox ? "https://api-sg.aliexpress.com/rest" : "https://api.aliexpress.com/rest"
}

/**
 * IOP REST call with auto-refreshed access token + HMAC-SHA256 signature.
 * @param apiPath e.g. "/auth/token/refresh" or "aliexpress.ds.product.get"
 */
export async function aliexpressRequest(
  apiPath: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const config = readAliExpressConfig()
  if (!config.appKey || !config.appSecret) {
    throw new AliExpressApiError("ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET required")
  }

  const accessToken = await getValidAccessToken()
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`
  const qs: Record<string, string> = {
    app_key: config.appKey,
    access_token: accessToken,
    session: accessToken,
    sign_method: "sha256",
    timestamp: getAliExpressTimestampMs(),
    ...params,
  }
  // Sign without duplicating access fields incorrectly — include all except sign
  qs.sign = signAliExpressIopHmacSha256(path, qs, config.appSecret)

  const url = `${restHost(config.sandbox)}${path}?${encodeAliExpressQuery(qs)}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    })
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new AliExpressApiError("AliExpress request timed out")
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }

  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new AliExpressApiError(`AliExpress non-JSON (HTTP ${res.status})`)
  }

  const root = asRecord(json)
  if (root?.type === "ISV" || root?.error_response) {
    const err = asRecord(root.error_response) ?? root
    const msg =
      (typeof err.message === "string" && err.message) ||
      (typeof err.msg === "string" && err.msg) ||
      "AliExpress API error"
    throw new AliExpressApiError(msg, {
      code: typeof err.code === "string" || typeof err.code === "number" ? err.code : undefined,
    })
  }

  console.log("[aliexpress-client]", {
    apiPath: path,
    httpStatus: res.status,
    result: "ok",
  })

  return json
}

/** TOP sync client with auto-refresh (legacy DS product methods). */
export async function createAliExpressClient(): Promise<AliExpressClient> {
  return createLegacyClient()
}

/** Convenience: TOP method call with refreshed token. */
export async function aliexpressTopRequest(
  method: string,
  bizParams: Record<string, string> = {}
): Promise<unknown> {
  const client = await createAliExpressClient()
  const json = await client.request(method, bizParams)
  return unwrapAliExpressMethodResponse(json, method) ?? json
}
