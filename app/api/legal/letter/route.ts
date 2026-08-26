import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { generateLegalLetter, type LegalLetterType } from "@/lib/legal/letters"
import type { LegalIssue } from "@/lib/legal/scan-types"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const postSchema = z
  .object({
    supplierId: z.string().min(1),
    scanId: z.string().optional(),
    type: z.enum(["mise_en_demeure", "avertissement"] satisfies LegalLetterType[]),
  })
  .strict()

export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const letters = await prisma.legalLetter.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    const supplierIds = [...new Set(letters.map((l) => l.supplierId))] as string[]
    const suppliers = await prisma.user.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true, email: true },
    })
    const supplierById = new Map(suppliers.map((s) => [s.id, s]))

    return Response.json({
      ok: true,
      letters: letters.map((row) => {
        const supplier = supplierById.get(row.supplierId)
        return {
          id: row.id,
          supplierId: row.supplierId,
          supplierName: supplier?.name ?? supplier?.email ?? row.supplierId,
          scanId: row.scanId,
          type: row.type,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          preview: row.contentMarkdown.slice(0, 180),
          viewUrl: `/dashboard/admin/legal/lettre/${row.id}`,
        }
      }),
    })
  } catch (error) {
    console.error("[legal:letter]", {
      stage: "list",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "list_failed" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const body = postSchema.parse(await req.json())

    const supplier = await prisma.user.findUnique({
      where: { id: body.supplierId },
      select: {
        id: true,
        name: true,
        email: true,
        merchantLegalProfile: {
          select: { legalEntityName: true, siret: true },
        },
      },
    })
    if (!supplier) {
      return Response.json({ ok: false, error: "supplier_not_found" }, { status: 404 })
    }

    let issues: LegalIssue[] = []
    let targetName: string | undefined

    if (body.scanId) {
      const scan = await prisma.legalScan.findUnique({ where: { id: body.scanId } })
      if (!scan) {
        return Response.json({ ok: false, error: "scan_not_found" }, { status: 404 })
      }
      issues = scan.issues as LegalIssue[]
      targetName = scan.targetName
    }

    if (issues.length === 0) {
      issues = [
        {
          code: "L121-1",
          severity: "high",
          message: "Manquement de conformité constaté sur le catalogue fournisseur Affisell.",
        },
      ]
    }

    const generated = await generateLegalLetter({
      type: body.type,
      supplier: {
        id: supplier.id,
        name: supplier.name,
        email: supplier.email,
        siret: supplier.merchantLegalProfile?.siret,
        legalEntityName: supplier.merchantLegalProfile?.legalEntityName,
      },
      issues,
      targetName,
      scanId: body.scanId ?? null,
    })

    const letter = await prisma.legalLetter.create({
      data: {
        supplierId: supplier.id,
        scanId: body.scanId ?? null,
        type: body.type,
        contentMarkdown: generated.letterMarkdown,
        contentHtml: generated.letterHtml,
        status: "draft",
      },
    })

    console.log("[legal:letter]", {
      stage: "generate",
      letterId: letter.id,
      supplierId: supplier.id,
      type: body.type,
      scanId: body.scanId ?? null,
    })

    return Response.json({
      ok: true,
      letterId: letter.id,
      letterMarkdown: generated.letterMarkdown,
      letterHtml: generated.letterHtml,
      viewUrl: `/dashboard/admin/legal/lettre/${letter.id}`,
    })
  } catch (error) {
    console.error("[legal:letter]", {
      stage: "generate",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "generate_failed" }, { status: 500 })
  }
}
