import "server-only"

import { createHash } from "node:crypto"

import type { TryOnAngle } from "@/lib/try-on/try-on-shared"

export function buildTryOnResultHash(input: {
  inputUrl: string
  productId: string
  angle: TryOnAngle
}): string {
  const normalized = input.inputUrl.trim().split("?")[0] ?? input.inputUrl.trim()
  const payload = `${normalized}|${input.productId}|${input.angle}`
  return createHash("sha256").update(payload).digest("hex")
}

export function hashClientIp(ip: string): string {
  return createHash("sha256").update(`tryon-ip:${ip.trim()}`).digest("hex").slice(0, 32)
}
