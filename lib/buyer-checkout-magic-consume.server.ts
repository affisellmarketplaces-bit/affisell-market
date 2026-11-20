import "server-only"

import { createHash } from "node:crypto"

import { prisma } from "@/lib/prisma"

/**
 * A checkout magic token (`lib/buyer-checkout-magic.ts`, 10-minute HMAC token handed to the success page) opens a buyer
 * session without a password. It used to be accepted as many times as it was presented during those 10 minutes, so a
 * copy of it (a log, a proxy, a shared device) was a session. It is now SINGLE-USE: the first sign-in records its hash
 * in the Auth.js `VerificationToken` table (present since the baseline migration, unused until now — no migration), and
 * the unique constraint on `token` refuses every later use, on any instance.
 *
 * Fails CLOSED: if the row cannot be written for any other reason (database down), the token is refused — the buyer can
 * still sign in normally; a session is never opened on an unrecorded token.
 */
const IDENTIFIER_PREFIX = "checkout-magic:"

export function checkoutMagicTokenDigest(token: string): string {
  return createHash("sha256").update(`checkout-magic:v1:${token}`, "utf8").digest("hex")
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "P2002")
}

export async function consumeCheckoutMagicTokenOnce(args: {
  token: string
  userId: string
  expiresAtMs: number
}): Promise<{ ok: true } | { ok: false; reason: "already_used" | "store_unavailable" }> {
  try {
    await prisma.verificationToken.create({
      data: {
        identifier: `${IDENTIFIER_PREFIX}${args.userId}`,
        token: checkoutMagicTokenDigest(args.token),
        expires: new Date(args.expiresAtMs),
      },
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      console.warn("[auth checkout-magic]", { result: "replay_refused", userId: args.userId })
      return { ok: false, reason: "already_used" }
    }
    console.error("[auth checkout-magic]", {
      result: "store_unavailable",
      message: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, reason: "store_unavailable" }
  }

  // Housekeeping, best effort: expired markers are useless (the HMAC token itself has expired).
  void prisma.verificationToken
    .deleteMany({ where: { identifier: { startsWith: IDENTIFIER_PREFIX }, expires: { lt: new Date() } } })
    .catch(() => undefined)
  return { ok: true }
}
