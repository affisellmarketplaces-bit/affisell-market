import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { maskEmailForLog } from "@/lib/emails/mask-email"
import { sendEmailVerificationEmail } from "@/lib/emails/send-email-verification"
import { prisma } from "@/lib/prisma"

/**
 * E-mail address verification for password accounts (finalisation master doc, E1).
 *
 * A password signup used to leave `User.emailVerified` empty forever: nothing proved the person who signed up owns the
 * address (only OAuth providers set it). Now the signup sends a link (48 h, single use); opening it sets
 * `emailVerified`. Storage = the Auth.js `VerificationToken` table (baseline migration, unused until now — no migration):
 * identifier `email-verify:<userId>`, token = SHA-256 of the link's secret (the secret itself is never stored).
 *
 * What it does NOT do (founder decision): block anything for an unverified account. `emailVerified` is already read as
 * an ownership proof by `lib/buyer-account-ownership.server.ts`; requiring it for payouts, publication or sign-in is a
 * product decision (see docs/FINALISATION-MASTER.md).
 */
const IDENTIFIER_PREFIX = "email-verify:"
const TTL_MS = 48 * 60 * 60 * 1000

function digest(secret: string): string {
  return createHash("sha256").update(`email-verify:v1:${secret}`, "utf8").digest("hex")
}

export type IssueEmailVerificationResult =
  | { ok: true; sent: boolean }
  | { ok: false; reason: "user_not_found" | "already_verified" | "no_password" | "store_failed" }

/** Replaces any pending link of the account and e-mails a new one. Never throws. */
export async function issueEmailVerification(args: {
  userId: string
  locale?: string | null
}): Promise<IssueEmailVerificationResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: args.userId },
      select: { id: true, email: true, name: true, emailVerified: true, password: true },
    })
    if (!user) return { ok: false, reason: "user_not_found" }
    if (user.emailVerified) return { ok: false, reason: "already_verified" }
    // OAuth-only accounts get the provider's verification; guest buyers have no account to verify.
    if (!user.password) return { ok: false, reason: "no_password" }

    const secret = randomBytes(32).toString("hex")
    const identifier = `${IDENTIFIER_PREFIX}${user.id}`
    await prisma.$transaction([
      prisma.verificationToken.deleteMany({ where: { identifier } }),
      prisma.verificationToken.create({
        data: { identifier, token: digest(secret), expires: new Date(Date.now() + TTL_MS) },
      }),
    ])

    const verifyUrl = `${resolveAppUrl()}/api/auth/verify-email?token=${encodeURIComponent(secret)}`
    const sent = await sendEmailVerificationEmail({
      accountEmail: user.email,
      name: user.name,
      verifyUrl,
      locale: args.locale,
    })
    console.log("[auth-email-verify]", {
      userId: user.id,
      accountEmail: maskEmailForLog(user.email),
      result: sent.ok ? "email_sent" : "email_skipped",
      error: sent.ok ? undefined : sent.error,
    })
    return { ok: true, sent: sent.ok }
  } catch (error) {
    console.error("[auth-email-verify]", {
      userId: args.userId,
      result: "issue_failed",
      message: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, reason: "store_failed" }
  }
}

export type ConsumeEmailVerificationResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" }

/**
 * Consumes a link: the token row is DELETED first (single use — of two concurrent openings only one finds it), then
 * `emailVerified` is set. Fails closed on any database error (`invalid`: the user can ask for a new link).
 */
export async function consumeEmailVerification(secretRaw: string): Promise<ConsumeEmailVerificationResult> {
  const secret = secretRaw.trim()
  if (!/^[0-9a-f]{64}$/.test(secret)) return { ok: false, reason: "invalid" }
  const token = digest(secret)
  try {
    const row = await prisma.verificationToken.findUnique({ where: { token } })
    if (!row || !row.identifier.startsWith(IDENTIFIER_PREFIX)) return { ok: false, reason: "invalid" }
    const userId = row.identifier.slice(IDENTIFIER_PREFIX.length)

    return await prisma.$transaction(async (tx) => {
      const deleted = await tx.verificationToken.deleteMany({ where: { token, identifier: row.identifier } })
      if (deleted.count !== 1) return { ok: false as const, reason: "invalid" as const }
      if (row.expires.getTime() < Date.now()) return { ok: false as const, reason: "expired" as const }
      const updated = await tx.user.updateMany({
        where: { id: userId, emailVerified: null },
        data: { emailVerified: new Date() },
      })
      console.log("[auth-email-verify]", { userId, result: updated.count === 1 ? "verified" : "already_verified" })
      return { ok: true as const, userId }
    })
  } catch (error) {
    console.error("[auth-email-verify]", {
      result: "consume_failed",
      message: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, reason: "invalid" }
  }
}
