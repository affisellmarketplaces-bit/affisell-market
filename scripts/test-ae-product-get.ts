#!/usr/bin/env npx tsx
import { readAliExpressConfig } from "../lib/aliexpress-config"
import { createAliExpressClient } from "../lib/aliexpress-open-api"
import { mapAliExpressGetProductResponse } from "../lib/aliexpress-product-map"

async function main() {
  const productId = process.argv[2]?.trim() || "1005012130287204"
  const config = readAliExpressConfig()
  console.log("[ae-product-test]", {
    sandbox: config.sandbox,
    aliexpressEnv: process.env.ALIEXPRESS_ENV ?? "(unset)",
    hasAppKey: Boolean(config.appKey),
    hasTokens: Boolean(config.accessToken || config.refreshToken),
  })

  try {
    const client = await createAliExpressClient()
    const raw = await client.getProduct(productId)
    const mapped = mapAliExpressGetProductResponse(raw, productId)
    console.log("[ae-product-test]", {
      result: "ok",
      name: mapped.name.slice(0, 80),
      priceCents: mapped.basePriceCents,
      images: mapped.images.length,
      stock: mapped.stock,
    })
  } catch (e) {
    console.error("[ae-product-test]", {
      result: "fail",
      error: e instanceof Error ? e.message : String(e),
    })
    process.exit(1)
  }
}

void main()
