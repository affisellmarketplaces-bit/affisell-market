import "server-only"

import { createHash, randomBytes } from "node:crypto"

import bcrypt from "bcryptjs"

import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { sendPasswordResetEmail } from "@/lib/emails/send-password-reset"
import { isValidEmailIdentifier } from "@/lib/auth-login-portal"
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

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!user) {
    console.log("[auth-forgot-password]", { email, result: "unknown_email" })
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

  const portalParam =
    user.role === "AFFILIATE"
      ? "&portal=affiliate"
      : user.role === "SUPPLIER"
        ? "&portal=supplier"
        : ""
  const resetUrl = `${resolveAppUrl()}/auth/reset-password?token=${encodeURIComponent(token)}${portalParam}`
  const sent = await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
  })

  console.log("[auth-forgot-password]", {
    userId: user.id,
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
  if (passwordRaw.length < 8) {
    return { ok: false, error: "password_too_short" }
  }

  const tokenHash = hashResetToken(token)
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true },
  })

  if (!row || row.expiresAt.getTime() < Date.now()) {
    if (row) {
      await prisma.passwordResetToken.delete({ where: { id: row.id } }).catch(() => {})
    }
    return { ok: false, error: "invalid_token" }
  }

  const hash = await bcrypt.hash(passwordRaw, 10)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { password: hash },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
  ])

  console.log("[auth-reset-password]", { userId: row.userId, result: "ok" })
  return { ok: true }
}
