import { createHash, randomBytes } from "node:crypto"

import { prisma } from "@/lib/prisma"

const KEY_PREFIX = "afs_ai_"
const MAX_ACTIVE_KEYS_PER_USER = 10

export function hashAiConnectionKey(plain: string): string {
  return createHash("sha256").update(`affisell:ai:${plain}`).digest("hex")
}

export function generateAiConnectionPlainKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`
}

export function isAiConnectionPlainKey(value: string): boolean {
  return value.startsWith(KEY_PREFIX) && value.length > KEY_PREFIX.length + 16
}

export function aiKeyBearerFromRequest(req: Request): string | null {
  const m = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() ?? null
}

export type AiKeyPrincipal = { keyId: string; userId: string; role: string }

/** Resolves a plain key to its owner, or null for unknown / revoked keys. */
export async function resolveAiConnectionKey(plain: string): Promise<AiKeyPrincipal | null> {
  if (!isAiConnectionPlainKey(plain)) return null
  const row = await prisma.aiConnectionKey.findFirst({
    where: { tokenHash: hashAiConnectionKey(plain), revokedAt: null },
    select: { id: true, userId: true, user: { select: { role: true } } },
  })
  if (!row) return null

  void prisma.aiConnectionKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return { keyId: row.id, userId: row.userId, role: row.user.role }
}

export async function createAiConnectionKey(params: {
  userId: string
  label?: string
}): Promise<{ id: string; key: string; label: string; prefix: string; createdAt: Date } | null> {
  const active = await prisma.aiConnectionKey.count({
    where: { userId: params.userId, revokedAt: null },
  })
  if (active >= MAX_ACTIVE_KEYS_PER_USER) return null

  const key = generateAiConnectionPlainKey()
  const label = (params.label ?? "AI").trim().slice(0, 80) || "AI"
  const prefix = key.slice(0, KEY_PREFIX.length + 4)
  const row = await prisma.aiConnectionKey.create({
    data: { userId: params.userId, label, prefix, tokenHash: hashAiConnectionKey(key) },
    select: { id: true, createdAt: true },
  })
  return { ...row, key, label, prefix }
}

export async function revokeAiConnectionKey(params: {
  userId: string
  keyId: string
}): Promise<boolean> {
  const res = await prisma.aiConnectionKey.updateMany({
    where: { id: params.keyId, userId: params.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return res.count > 0
}

export async function listAiConnectionKeys(userId: string) {
  return prisma.aiConnectionKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, prefix: true, createdAt: true, lastUsedAt: true },
  })
}

export { MAX_ACTIVE_KEYS_PER_USER }
