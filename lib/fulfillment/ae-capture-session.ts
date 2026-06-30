import { prisma } from "@/lib/prisma"

const SESSION_TTL_MS = 15 * 60 * 1000

export async function purgeExpiredAeCaptureSessions(): Promise<void> {
  await prisma.adminAeCaptureSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
}

export async function createAeCaptureSession(productId: string): Promise<string> {
  await purgeExpiredAeCaptureSessions()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  const row = await prisma.adminAeCaptureSession.create({
    data: { productId, expiresAt },
    select: { id: true },
  })
  return row.id
}

export async function storeAeCaptureSessionResult(
  sessionId: string,
  productId: string,
  result: unknown
): Promise<boolean> {
  const updated = await prisma.adminAeCaptureSession.updateMany({
    where: {
      id: sessionId,
      productId,
      expiresAt: { gt: new Date() },
    },
    data: { result: result as object },
  })
  return updated.count > 0
}

export async function readAeCaptureSessionResult(
  sessionId: string,
  productId: string
): Promise<unknown | null> {
  const row = await prisma.adminAeCaptureSession.findFirst({
    where: {
      id: sessionId,
      productId,
      expiresAt: { gt: new Date() },
    },
    select: { result: true },
  })
  return row?.result ?? null
}

/** Peek result without deleting — safe for concurrent pollers (relay + admin tab). */
export async function peekAeCaptureSession(
  sessionId: string,
  productId: string
): Promise<unknown | null> {
  return readAeCaptureSessionResult(sessionId, productId)
}

export async function acknowledgeAeCaptureSession(
  sessionId: string,
  productId: string
): Promise<boolean> {
  const deleted = await prisma.adminAeCaptureSession.deleteMany({
    where: {
      id: sessionId,
      productId,
    },
  })
  return deleted.count > 0
}

/** @deprecated Prefer peek + acknowledge */
export async function consumeAeCaptureSession(
  sessionId: string,
  productId: string
): Promise<unknown | null> {
  const result = await peekAeCaptureSession(sessionId, productId)
  if (!result) return null
  await acknowledgeAeCaptureSession(sessionId, productId)
  return result
}
