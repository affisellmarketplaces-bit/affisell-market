import "server-only"

import { createHash, randomBytes } from "node:crypto"

import bcrypt from "bcryptjs"

import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import type { PasswordResetPortal } from "@/emails/password-reset"
import { maskEmailForLog } from "@/lib/emails/mask-email"
import { sendPasswordResetEmail } from "@/lib/emails/send-password-reset"
import { isValidEmailIdentifier } from "@/lib/auth-login-portal"
import { checkPasswordPolicy } from "@/lib/password-policy"
import { prisma } from "@/lib/prisma"

const TOKEN_TTL_MS = 60 * 60 * 1000

function hashResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

function newResetToken(): string {
  return randomBytes(32).toString("hex")
}

/** Always resolves without leaking whether the email exists. */
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase()
  if (!isValidEmailIdentifier(email)) return

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!user) {
    // Never the address in clear: logs are kept and shipped to third parties (Logtail, Sentry breadcrumbs).
    console.log("[auth-forgot-password]", { email: maskEmailForLog(email), result: "unknown_email" })
    return
  }

  const token = newResetToken()
  const tokenHash = hashResetToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    }),
  ])

  const portal: PasswordResetPortal =
    user.role === "AFFILIATE"
      ? "affiliate"
      : user.role === "SUPPLIER"
        ? "supplier"
        : user.role === "AGENT"
          ? "agent"
          : null
  const portalParam = portal ? `&portal=${portal}` : ""
  const resetUrl = `${resolveAppUrl()}/auth/reset-password?token=${encodeURIComponent(token)}${portalParam}`
  const accountEmail = user.email.trim().toLowerCase()

  const sent = await sendPasswordResetEmail({
    accountEmail,
    name: user.name,
    resetUrl,
    portal,
  })

  console.log("[auth-forgot-password]", {
    userId: user.id,
    accountEmail: maskEmailForLog(accountEmail),
    result: sent.ok ? "email_sent" : "email_skipped",
    error: sent.ok ? undefined : sent.error,
  })
}

export async function resetPasswordWithToken(
  tokenRaw: string,
  passwordRaw: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = tokenRaw.trim()
  if (token.length < 16) {
    return { ok: false, error: "invalid_token" }
  }

  const tokenHash = hashResetToken(token)
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, user: { select: { email: true } } },
  })

  if (!row || row.expiresAt.getTime() < Date.now()) {
    if (row) {
      await prisma.passwordResetToken.delete({ where: { id: row.id } }).catch(() => {})
    }
    return { ok: false, error: "invalid_token" }
  }

  // Same rule as the signup (lib/password-policy.ts). Checked after the token so an invalid link says so first.
  const policy = checkPasswordPolicy(passwordRaw, { email: row.user?.email })
  if (!policy.ok) {
    return { ok: false, error: policy.error }
  }

  const hash = await bcrypt.hash(passwordRaw, 10)

  // The token is CONSUMED in the same transaction as the password write, and only if it still exists and is unexpired:
  // two concurrent submissions of one link can no longer both set a password (the second finds nothing to delete).
  const applied = await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.deleteMany({
      where: { id: row.id, expiresAt: { gte: new Date() } },
    })
    if (consumed.count !== 1) return false
    await tx.user.update({ where: { id: row.userId }, data: { password: hash } })
    await tx.passwordResetToken.deleteMany({ where: { userId: row.userId } })
    return true
  })
  if (!applied) {
    return { ok: false, error: "invalid_token" }
  }

  // Every session opened before this reset ends at its next check (lib/auth-session-revocation.ts: the password
  // fingerprint changed).
  console.log("[auth-reset-password]", { userId: row.userId, result: "ok", sessions: "revoked_at_next_check" })
  return { ok: true }
}
