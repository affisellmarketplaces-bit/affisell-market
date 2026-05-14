import type { SupplierAdapter } from "@/lib/suppliers/types"
import { RestSupplierAdapter } from "@/lib/suppliers/rest-adapter"

export function buildSupplierAdapterFromConfig(args: {
  apiEndpoint: string | null | undefined
  apiKeyPlain: string
  config: Record<string, unknown>
}): SupplierAdapter {
  const endpoint = args.apiEndpoint?.trim()
  if (!endpoint) throw new Error("missing_api_endpoint")
  const createOrderPath =
    typeof args.config.createOrderPath === "string" ? args.config.createOrderPath : undefined
  const inventoryPath = typeof args.config.inventoryPath === "string" ? args.config.inventoryPath : undefined
  const extraHeaders =
    args.config.extraHeaders && typeof args.config.extraHeaders === "object" && !Array.isArray(args.config.extraHeaders)
      ? (args.config.extraHeaders as Record<string, string>)
      : undefined
  return new RestSupplierAdapter(endpoint, args.apiKeyPlain, { createOrderPath, inventoryPath, extraHeaders })
}
