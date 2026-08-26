import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { autoFixProduct } from "@/lib/legal/auto-fix"
import { createProof } from "@/lib/legal/proof"
import type { LegalIssue } from "@/lib/legal/scan-types"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const postSchema = z.object({ scanId: z.string().min(1) }).strict()

const patchSchema = z
  .object({
    scanId: z.string().min(1),
    apply: z.literal(true),
  })
  .strict()

async function loadProductFixContext(scanId: string) {
  const scan = await prisma.legalScan.findUnique({ where: { id: scanId } })
  if (!scan) return { error: "scan_not_found" as const }
  if (scan.type !== "product") return { error: "not_product_scan" as const }

  const product = await prisma.product.findUnique({
    where: { id: scan.targetId },
    select: {
      id: true,
      name: true,
      description: true,
      descriptionBullets: true,
      tags: true,
      compareAt: true,
      isOnSale: true,
      basePriceCents: true,
    },
  })
  if (!product) return { error: "product_not_found" as const }

  const issues = scan.issues as LegalIssue[]
  const fixed = autoFixProduct(
    {
      name: product.name,
      description: product.description,
      descriptionBullets: product.descriptionBullets,
      tags: product.tags,
      compareAt: product.compareAt != null ? Number(product.compareAt) : null,
      isOnSale: product.isOnSale,
      basePriceCents: product.basePriceCents,
    },
    issues
  )

  return { scan, product, issues, fixed }
}

/** Preview auto-fix without DB write. */
export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const { scanId } = postSchema.parse(await req.json())
    const ctx = await loadProductFixContext(scanId)

    if ("error" in ctx) {
      const status = ctx.error === "scan_not_found" ? 404 : 400
      return Response.json({ ok: false, error: ctx.error }, { status })
    }

    const { product, issues, fixed } = ctx

    console.log("[legal:fix]", {
      stage: "preview",
      scanId,
      productId: product.id,
      changes: fixed.changes.length,
    })

    return Response.json({
      ok: true,
      scanId,
      productId: product.id,
      original: {
        title: product.name,
        description: product.description,
        descriptionBullets: product.descriptionBullets,
        tags: product.tags,
        compareAt: product.compareAt != null ? Number(product.compareAt) : null,
        isOnSale: product.isOnSale,
      },
      fixed: {
        title: fixed.fixedTitle,
        description: fixed.fixedDesc,
        descriptionBullets: fixed.fixedBullets,
        tags: fixed.fixedTags,
        clearCompareAt: fixed.clearCompareAt,
      },
      changes: fixed.changes,
      issues,
    })
  } catch (error) {
    console.error("[legal:fix]", {
      stage: "preview",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }
}

/** Apply auto-fix to Product + LegalFixLog + scan status fixed. */
export async function PATCH(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const { scanId } = patchSchema.parse(await req.json())
    const ctx = await loadProductFixContext(scanId)

    if ("error" in ctx) {
      const status = ctx.error === "scan_not_found" ? 404 : 400
      return Response.json({ ok: false, error: ctx.error }, { status })
    }

    const { scan, product, fixed } = ctx
    const adminId = gate.session.user.id

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: product.id },
        data: {
          name: fixed.fixedTitle,
          description: fixed.fixedDesc,
          descriptionBullets: fixed.fixedBullets,
          tags: fixed.fixedTags,
          ...(fixed.clearCompareAt
            ? { compareAt: null, isOnSale: false }
            : {}),
        },
      })

      await tx.legalScan.update({
        where: { id: scan.id },
        data: { status: "fixed" },
      })

      await tx.legalFixLog.create({
        data: {
          scanId: scan.id,
          productId: product.id,
          changes: fixed.changes,
          appliedBy: adminId,
        },
      })
    })

    await createProof({
      productId: product.id,
      action: "fix",
      payload: {
        scanId: scan.id,
        appliedBy: adminId,
        changes: fixed.changes,
        appliedAt: new Date().toISOString(),
      },
    })

    console.log("[legal:fix]", {
      stage: "apply",
      scanId,
      productId: product.id,
      appliedBy: adminId,
      changes: fixed.changes.length,
    })

    return Response.json({
      ok: true,
      scanId,
      productId: product.id,
      changes: fixed.changes,
    })
  } catch (error) {
    console.error("[legal:fix]", {
      stage: "apply",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "apply_failed" }, { status: 500 })
  }
}
