import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { createProof } from "@/lib/legal/proof"
import {
  primaryIssueMessage,
  scanProductsBatch,
  scanSuppliersBatch,
  type LegalIssue,
  type LegalProductScanInput,
  type LegalSupplierScanInput,
} from "@/lib/legal/scanner"

export const LEGAL_SCAN_PRODUCT_LIMIT = 50
export const LEGAL_SCAN_SUPPLIER_LIMIT = 50
export const LEGAL_GUARDIAN_ALERT_THRESHOLD = 70

export type LegalScanRunStats = {
  dryRun: boolean
  productsScanned: number
  suppliersScanned: number
  scansWritten: number
  highRiskCount: number
  openAiUsed: boolean
}

export type LegalScanHighRiskRow = {
  id: string
  type: string
  targetId: string
  targetName: string
  riskScore: number
  primaryIssue: string
  issueCode: string
}

async function persistLegalScan(input: {
  type: string
  targetId: string
  targetName: string
  riskScore: number
  issues: LegalIssue[]
  dryRun: boolean
}): Promise<{ id: string; created: boolean } | null> {
  if (input.dryRun) {
    return { id: `dry-${input.type}-${input.targetId}`, created: true }
  }

  const issuesJson = input.issues as unknown as Prisma.InputJsonValue
  const existing = await prisma.legalScan.findFirst({
    where: { type: input.type, targetId: input.targetId, status: "open" },
    select: { id: true },
  })

  if (existing) {
    await prisma.legalScan.update({
      where: { id: existing.id },
      data: {
        targetName: input.targetName,
        riskScore: input.riskScore,
        issues: issuesJson,
      },
    })
    return { id: existing.id, created: false }
  }

  const row = await prisma.legalScan.create({
    data: {
      type: input.type,
      targetId: input.targetId,
      targetName: input.targetName,
      riskScore: input.riskScore,
      issues: issuesJson,
      status: "open",
    },
  })
  return { id: row.id, created: true }
}

export async function runLegalGuardianScan(options?: {
  dryRun?: boolean
  productLimit?: number
  supplierLimit?: number
}): Promise<{ stats: LegalScanRunStats; highRisk: LegalScanHighRiskRow[] }> {
  const dryRun = options?.dryRun ?? false
  const productLimit = options?.productLimit ?? LEGAL_SCAN_PRODUCT_LIMIT
  const supplierLimit = options?.supplierLimit ?? LEGAL_SCAN_SUPPLIER_LIMIT
  const openAiUsed = Boolean(process.env.OPENAI_API_KEY?.trim())

  console.log("[legal:guardian]", { result: "start", dryRun, productLimit, supplierLimit, openAiUsed })

  const [products, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, isDraft: false },
      take: productLimit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        descriptionBullets: true,
        tags: true,
        basePriceCents: true,
        compareAt: true,
        isOnSale: true,
        supplierTag: true,
        listingKind: true,
        images: true,
      },
    }),
    prisma.user.findMany({
      where: { role: "SUPPLIER" },
      take: supplierLimit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        isVerifiedSupplier: true,
        trustScore: true,
        merchantLegalProfile: {
          select: {
            legalStatus: true,
            verificationStatus: true,
            siret: true,
            vatNumber: true,
          },
        },
        supplierProfile: { select: { trustScore: true } },
        _count: { select: { products: true } },
      },
    }),
  ])

  const productInputs: LegalProductScanInput[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    descriptionBullets: p.descriptionBullets,
    tags: p.tags,
    basePriceCents: p.basePriceCents,
    compareAt: p.compareAt != null ? Number(p.compareAt) : null,
    isOnSale: p.isOnSale,
    supplierTag: p.supplierTag,
    listingKind: p.listingKind,
    images: p.images,
  }))

  const supplierInputs: LegalSupplierScanInput[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    isVerifiedSupplier: s.isVerifiedSupplier,
    trustScore: s.supplierProfile?.trustScore ?? s.trustScore,
    legalStatus: s.merchantLegalProfile?.legalStatus ?? null,
    verificationStatus: s.merchantLegalProfile?.verificationStatus ?? null,
    siret: s.merchantLegalProfile?.siret ?? null,
    vatNumber: s.merchantLegalProfile?.vatNumber ?? null,
    productCount: s._count.products,
  }))

  const [productResults, supplierResults] = await Promise.all([
    scanProductsBatch(productInputs),
    scanSuppliersBatch(supplierInputs),
  ])

  let scansWritten = 0
  const highRisk: LegalScanHighRiskRow[] = []

  for (const product of productInputs) {
    const scan = productResults.get(product.id) ?? { riskScore: 0, issues: [] }
    const persisted = await persistLegalScan({
      type: "product",
      targetId: product.id,
      targetName: product.name,
      riskScore: scan.riskScore,
      issues: scan.issues,
      dryRun,
    })
    if (persisted) scansWritten += 1

    if (!dryRun && scan.riskScore >= LEGAL_GUARDIAN_ALERT_THRESHOLD) {
      await createProof({
        productId: product.id,
        action: "scan",
        payload: {
          scanId: persisted?.id,
          riskScore: scan.riskScore,
          issues: scan.issues,
          scannedAt: new Date().toISOString(),
        },
      }).catch((error) => {
        console.error("[legal:guardian]", {
          result: "proof_failed",
          productId: product.id,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }

    if (scan.riskScore > LEGAL_GUARDIAN_ALERT_THRESHOLD) {
      const primary = scan.issues[0]
      highRisk.push({
        id: persisted?.id ?? product.id,
        type: "product",
        targetId: product.id,
        targetName: product.name,
        riskScore: scan.riskScore,
        primaryIssue: primaryIssueMessage(scan.issues),
        issueCode: primary?.code ?? "L121-1",
      })
    }
  }

  for (const supplier of supplierInputs) {
    const scan = supplierResults.get(supplier.id) ?? { riskScore: 0, issues: [] }
    const targetName = supplier.name?.trim() || supplier.email
    const persisted = await persistLegalScan({
      type: "supplier",
      targetId: supplier.id,
      targetName,
      riskScore: scan.riskScore,
      issues: scan.issues,
      dryRun,
    })
    if (persisted) scansWritten += 1

    if (scan.riskScore > LEGAL_GUARDIAN_ALERT_THRESHOLD) {
      const primary = scan.issues[0]
      highRisk.push({
        id: persisted?.id ?? supplier.id,
        type: "supplier",
        targetId: supplier.id,
        targetName,
        riskScore: scan.riskScore,
        primaryIssue: primaryIssueMessage(scan.issues),
        issueCode: primary?.code ?? "DSA-TRADER",
      })
    }
  }

  const stats: LegalScanRunStats = {
    dryRun,
    productsScanned: productInputs.length,
    suppliersScanned: supplierInputs.length,
    scansWritten,
    highRiskCount: highRisk.length,
    openAiUsed,
  }

  console.log("[legal:guardian]", { result: "done", ...stats })

  return { stats, highRisk }
}

export async function listRecentLegalScans(limit = 20) {
  return prisma.legalScan.findMany({
    orderBy: [{ riskScore: "desc" }, { updatedAt: "desc" }],
    take: limit,
  })
}

export async function updateLegalScanStatus(
  id: string,
  status: "open" | "fixed" | "ignored"
): Promise<void> {
  await prisma.legalScan.update({
    where: { id },
    data: { status },
  })
}
