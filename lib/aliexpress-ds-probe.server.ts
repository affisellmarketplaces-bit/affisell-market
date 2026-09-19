import "server-only"

import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"
import { getAliExpressApiReadyStatus } from "@/lib/aliexpress-api-ready.server"
import { getAliExpressDsProduct } from "@/lib/aliexpress-ds-sync"
import { readAliExpressConfig } from "@/lib/aliexpress-config"
import { getValidAccessToken } from "@/lib/aliexpress-oauth"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"
import {
  ALIEXPRESS_OAUTH_START_PATH,
  aliExpressOAuthReconnectHint,
  classifyAliExpressTokenError,
  shouldOfferAliExpressOAuthReconnect,
} from "@/lib/aliexpress-token-errors"

const DEFAULT_PROBE_PRODUCT_ID = "1005008719608144"

export type AliExpressDsProbeResult = {
  configured: boolean
  tokenSource: "env" | "db" | "none"
  accountHint: string | null
  productGetOk: boolean
  methodLabel: string | null
  productId: string
  error: string | null
  tokenErrorKind: ReturnType<typeof classifyAliExpressTokenError>
  /** Present only when OAuth reconnect is the right action (never for transient outages). */
  oauthReconnectUrl: string | null
  hint: string | null
}

/** Live DS product.get probe — used by DropForge health + ops. */
export async function probeAliExpressDsConnection(
  productId: string = DEFAULT_PROBE_PRODUCT_ID
): Promise<AliExpressDsProbeResult> {
  const id = parseAliExpressProductId(productId) ?? productId.trim()
  const status = await getAliExpressApiReadyStatus()

  if (!status.configured) {
    return {
      configured: false,
      tokenSource: status.tokenSource,
      accountHint: status.accountHint,
      productGetOk: false,
      methodLabel: null,
      productId: id,
      error: status.message,
      tokenErrorKind: "missing",
      oauthReconnectUrl: ALIEXPRESS_OAUTH_START_PATH,
      hint: aliExpressOAuthReconnectHint("missing"),
    }
  }

  const config = readAliExpressConfig()
  try {
    const accessToken = await getValidAccessToken()
    const { methodLabel } = await getAliExpressDsProduct({
      productId: id,
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken,
    })
    return {
      configured: true,
      tokenSource: status.tokenSource,
      accountHint: status.accountHint,
      productGetOk: true,
      methodLabel,
      productId: id,
      error: null,
      tokenErrorKind: null,
      oauthReconnectUrl: null,
      hint: null,
    }
  } catch (e) {
    const message = e instanceof AliExpressApiError ? e.message : e instanceof Error ? e.message : String(e)
    const tokenErrorKind = classifyAliExpressTokenError(message)
    console.log("[aliexpress-ds-probe]", {
      productId: id,
      result: "fail",
      tokenErrorKind,
      error: message.slice(0, 160),
    })
    return {
      configured: true,
      tokenSource: status.tokenSource,
      accountHint: status.accountHint,
      productGetOk: false,
      methodLabel: null,
      productId: id,
      error: message,
      tokenErrorKind,
      oauthReconnectUrl: shouldOfferAliExpressOAuthReconnect(tokenErrorKind)
        ? ALIEXPRESS_OAUTH_START_PATH
        : null,
      hint: aliExpressOAuthReconnectHint(tokenErrorKind) || message.slice(0, 240),
    }
  }
}
