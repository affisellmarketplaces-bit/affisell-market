"use server"

import { headers } from "next/headers"

import { signIn } from "@/auth"
import { consumeRateLimit } from "@/lib/api-rate-limit"
import {
  isDemoLabEnabled,
  resolveDemoLabAccount,
} from "@/lib/demo/demo-accounts-config"
import { ensureDemoLabUser } from "@/lib/demo/ensure-demo-users"
import type { DemoPersonaKey } from "@/lib/demo/demo-shared"

export type DemoLabEnterError = "disabled" | "not_configured" | "rate_limited" | "signin_failed"

export type DemoLabEnterResult = { ok: true } | { ok: false; error: DemoLabEnterError }

function rateLimitKeyFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")
  const first = forwarded?.split(",")[0]?.trim()
  const ip = first || h.get("x-real-ip")?.trim() || "unknown"
  return `ip:${ip}`
}

export async function enterDemoLabAction(persona: DemoPersonaKey): Promise<DemoLabEnterResult> {
  if (!isDemoLabEnabled()) {
    console.log("[demo-lab-enter]", { persona, result: "disabled" })
    return { ok: false, error: "disabled" }
  }

  const account = resolveDemoLabAccount(persona)
  if (!account) {
    console.log("[demo-lab-enter]", { persona, result: "not_configured" })
    return { ok: false, error: "not_configured" }
  }

  const h = await headers()
  const limited = consumeRateLimit(rateLimitKeyFromHeaders(h), {
    prefix: "demo-enter",
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (!limited.ok) {
    console.log("[demo-lab-enter]", { persona, result: "rate_limited", retrySec: limited.retrySec })
    return { ok: false, error: "rate_limited" }
  }

  try {
    await ensureDemoLabUser(persona)
    await signIn("credentials", {
      email: account.email,
      password: account.password,
      callbackUrl: account.redirectTo,
      redirectTo: account.redirectTo,
    })
    console.log("[demo-lab-enter]", { persona, email: account.email, result: "signed_in" })
    return { ok: true }
  } catch (error) {
    const isRedirect =
      error instanceof Error &&
      (error.message === "NEXT_REDIRECT" || error.message.includes("NEXT_REDIRECT"))
    if (isRedirect) {
      throw error
    }
    console.error("[demo-lab-enter]", { persona, result: "signin_failed", error })
    return { ok: false, error: "signin_failed" }
  }
}
