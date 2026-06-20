import { randomBytes } from "node:crypto"

function wcRandToken(prefix: string): string {
  return `${prefix}${randomBytes(20).toString("hex")}`
}

export type WooCommerceGeneratedKeys = {
  consumerKey: string
  consumerSecret: string
}

export function generateWooCommerceApiKeys(): WooCommerceGeneratedKeys {
  return {
    consumerKey: wcRandToken("ck_"),
    consumerSecret: wcRandToken("cs_"),
  }
}
