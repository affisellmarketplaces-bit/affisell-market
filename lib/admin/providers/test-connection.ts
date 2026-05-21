import type { FulfillmentProvider } from "@prisma/client"

import { decryptProviderConfig } from "@/lib/suppliers/decrypt-config"
import { RestSupplierAdapter } from "@/lib/suppliers/rest-adapter"

export type ConnectionTestResult = {
  ok: boolean
  message: string
  latencyMs?: number
}

export async function testFulfillmentProviderConnection(
  provider: Pick<
    FulfillmentProvider,
    "channelType" | "apiConfig" | "credentialsEncrypted"
  >
): Promise<ConnectionTestResult> {
  const started = Date.now()
  const config = decryptProviderConfig(provider)

  if (provider.channelType === "AFFISELL_NATIVE" || provider.channelType === "MANUAL") {
    return {
      ok: true,
      message: "No external API — in-platform fulfillment",
      latencyMs: Date.now() - started,
    }
  }

  const endpoint =
    typeof config.apiEndpoint === "string" && config.apiEndpoint.trim()
      ? config.apiEndpoint.trim()
      : null

  if (!endpoint) {
    return { ok: false, message: "Missing apiEndpoint in provider config" }
  }

  if (provider.channelType === "BLIND_REST") {
    const apiKey = config.apiKey
    if (!apiKey) {
      return { ok: false, message: "Missing sealed apiKey — use Seal Keys first" }
    }
    try {
      const adapter = new RestSupplierAdapter(endpoint, apiKey, {
        inventoryPath:
          typeof config.inventoryPath === "string" ? config.inventoryPath : undefined,
      })
      await adapter.getStock()
      return {
        ok: true,
        message: "Inventory endpoint reachable",
        latencyMs: Date.now() - started,
      }
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - started,
      }
    }
  }

  try {
    const res = await fetch(endpoint.replace(/\/$/, "") + "/health", {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: "application/json" },
    })
    if (res.ok) {
      return {
        ok: true,
        message: `HTTP ${res.status} from /health`,
        latencyMs: Date.now() - started,
      }
    }
    const head = await fetch(endpoint, {
      method: "HEAD",
      signal: AbortSignal.timeout(15_000),
    })
    return {
      ok: head.ok,
      message: head.ok ? `HTTP ${head.status} (HEAD)` : `HTTP ${head.status} — check URL`,
      latencyMs: Date.now() - started,
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - started,
    }
  }
}
