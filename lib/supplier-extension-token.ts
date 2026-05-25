import { createHash, randomBytes } from "node:crypto"

import { prisma } from "@/lib/prisma"

const TOKEN_PREFIX = "afs_ext_"

export function hashSupplierExtensionToken(plain: string): string {
  return createHash("sha256").update(`affisell:ext:${plain}`).digest("hex")
}

export function generateSupplierExtensionPlainToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`
}

export function isSupplierExtensionPlainToken(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX) && value.length > TOKEN_PREFIX.length + 16
}

export async function createSupplierExtensionToken(params: {
  userId: string
  label?: string
}): Promise<{ id: string; token: string; label: string; createdAt: Date }> {
  const plain = generateSupplierExtensionPlainToken()
  const tokenHash = hashSupplierExtensionToken(plain)
  const label = (params.label ?? "Browser").trim().slice(0, 80) || "Browser"

  const row = await prisma.supplierExtensionToken.create({
    data: {
      userId: params.userId,
      label,
      tokenHash,
    },
    select: { id: true, label: true, createdAt: true },
  })

  return { ...row, token: plain }
}

export async function revokeSupplierExtensionToken(params: {
  userId: string
  tokenId: string
}): Promise<boolean> {
  const updated = await prisma.supplierExtensionToken.updateMany({
    where: {
      id: params.tokenId,
      userId: params.userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  })
  return updated.count > 0
}

export async function resolveSupplierIdFromExtensionToken(
  plain: string
): Promise<string | null> {
  if (!isSupplierExtensionPlainToken(plain)) return null
  const tokenHash = hashSupplierExtensionToken(plain)
  const row = await prisma.supplierExtensionToken.findFirst({
    where: { tokenHash, revokedAt: null },
    select: { id: true, userId: true },
  })
  if (!row) return null

  void prisma.supplierExtensionToken
    .update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {})

  return row.userId
}
