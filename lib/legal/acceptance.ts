import "server-only"

import type { LegalAcceptance, LegalAcceptanceContext, Prisma } from "@prisma/client"

import { resolveAppLocale } from "@/lib/i18n-locale"
import { isRoleTermsVersionCurrent } from "@/lib/legal-versions"
import { computeLegalGateHash } from "@/lib/legal/legal-gate-cookie"
import { getCurrentVersion, getLegalDocument } from "@/lib/legal/lms-resolver"
import { getRequiredDocumentSlugs } from "@/lib/legal/required-documents"
import { prisma } from "@/lib/prisma"
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/request-client-meta"

type DbClient = Prisma.TransactionClient | typeof prisma

function dbClient(tx?: Prisma.TransactionClient): DbClient {
  return tx ?? prisma
}

export type RecordLegalAcceptanceInput = {
  userId?: string
  slug: string
  locale: string
  context: LegalAcceptanceContext
  req?: Request
  orderId?: string
  buyerEmail?: string | null
  ip?: string
  userAgent?: string
  tx?: Prisma.TransactionClient
}

export async function recordLegalAcceptance(
  input: RecordLegalAcceptanceInput
): Promise<LegalAcceptance | null> {
  const {
    userId,
    slug,
    locale,
    context,
    req,
    orderId,
    buyerEmail: buyerEmailInput,
    ip: ipInput,
    userAgent: userAgentInput,
    tx,
  } = input

  const resolvedLocale = resolveAppLocale(locale)
  const version = await getCurrentVersion(slug, resolvedLocale)
  if (!version) {
    console.log("[legal-acceptance]", { slug, locale: resolvedLocale, result: "no_version" })
    return null
  }

  const idempotencyKey = orderId
    ? `order:${orderId}:${slug}`
    : userId
      ? `user:${userId}:${slug}:${version.version}`
      : null

  if (!idempotencyKey) {
    console.log("[legal-acceptance]", { slug, result: "missing_idempotency_key" })
    return null
  }

  const ip = (ipInput ?? (req ? clientIpFromRequest(req) : "unknown")).slice(0, 45)
  const userAgent = userAgentInput ?? (req ? userAgentFromRequest(req) : "unknown")
  const buyerEmail =
    buyerEmailInput ?? req?.headers.get("x-buyer-email")?.trim() ?? null

  const db = dbClient(tx)

  try {
    const acceptance = await db.legalAcceptance.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        userId: userId ?? null,
        documentVersionId: version.id,
        acceptedAt: new Date(),
        ip,
        userAgent,
        context,
        orderId: orderId ?? null,
        buyerEmail,
        idempotencyKey,
      },
    })

    console.log("[legal-acceptance]", {
      slug,
      userId: userId ?? null,
      orderId: orderId ?? null,
      context,
      documentVersionId: version.id,
      result: "ok",
    })

    return acceptance
  } catch (e) {
    console.error("[legal-acceptance]", {
      slug,
      userId,
      orderId,
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

export async function attachOrderCgvAcceptance(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string
    userId?: string | null
    buyerEmail: string
    locale?: string | null
  }
): Promise<void> {
  const acceptance = await recordLegalAcceptance({
    tx,
    slug: "terms-of-sale",
    locale: args.locale ?? "fr",
    context: "CHECKOUT",
    orderId: args.orderId,
    userId: args.userId ?? undefined,
    buyerEmail: args.buyerEmail,
    ip: "stripe:checkout",
    userAgent: "stripe:webhook",
  })

  if (!acceptance) return

  await tx.order.update({
    where: { id: args.orderId },
    data: {
      cgvVersionId: acceptance.documentVersionId,
      cgvAcceptedAt: acceptance.acceptedAt,
    },
  })
}

async function userHasAnyLegalAcceptance(userId: string): Promise<boolean> {
  const count = await prisma.legalAcceptance.count({ where: { userId } })
  return count > 0
}

async function legacyIsDocumentAccepted(
  userId: string,
  slug: string,
  role: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cguAcceptedAt: true,
      privacyAcceptedAt: true,
      termsAcceptedAt: true,
      termsAcceptedVersion: true,
    },
  })
  if (!user) return false

  if (slug === "customer") return user.cguAcceptedAt != null
  if (slug === "privacy") return user.privacyAcceptedAt != null
  if (slug === "supplier" && role === "SUPPLIER") {
    return isRoleTermsVersionCurrent("SUPPLIER", user.termsAcceptedVersion)
  }
  if (slug === "affiliate" && role === "AFFILIATE") {
    return isRoleTermsVersionCurrent("AFFILIATE", user.termsAcceptedVersion)
  }
  return false
}

export async function isDocumentAccepted(
  userId: string,
  slug: string,
  role?: string
): Promise<boolean> {
  const doc = await getLegalDocument(slug)
  if (!doc?.currentVersionId) return false

  const hasLmsRows = await userHasAnyLegalAcceptance(userId)
  if (!hasLmsRows) {
    return legacyIsDocumentAccepted(userId, slug, role ?? "CUSTOMER")
  }

  const latest = await prisma.legalAcceptance.findFirst({
    where: { userId, documentVersion: { documentId: doc.id } },
    orderBy: { acceptedAt: "desc" },
  })

  return latest?.documentVersionId === doc.currentVersionId
}

export async function findFirstMissingDocumentSlug(
  userId: string,
  role: string
): Promise<string | null> {
  for (const slug of getRequiredDocumentSlugs(role)) {
    if (!(await isDocumentAccepted(userId, slug, role))) return slug
  }
  return null
}

export async function computeUserLegalGateHash(
  userId: string,
  role: string
): Promise<string | null> {
  const versionIds: string[] = []

  for (const slug of getRequiredDocumentSlugs(role)) {
    if (!(await isDocumentAccepted(userId, slug, role))) return null
    const doc = await getLegalDocument(slug)
    if (!doc?.currentVersionId) return null
    versionIds.push(doc.currentVersionId)
  }

  return computeLegalGateHash(versionIds)
}

export async function collectAcceptedCurrentVersionIds(
  userId: string,
  role: string
): Promise<string[]> {
  const versionIds: string[] = []
  for (const slug of getRequiredDocumentSlugs(role)) {
    const doc = await getLegalDocument(slug)
    if (doc?.currentVersionId && (await isDocumentAccepted(userId, slug, role))) {
      versionIds.push(doc.currentVersionId)
    }
  }
  return versionIds
}
