import { z } from "zod"
import type { Prisma } from "@prisma/client"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import {
  defaultDocumentData,
  generateLegalDocument,
  type GenerateDocumentInput,
} from "@/lib/legal/avocat-documents"
import type { LegalDocumentType } from "@/lib/legal/document-types"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const postSchema = z
  .object({
    type: z.enum(["cgv", "cgu", "mentions", "contrat_fournisseur"] satisfies LegalDocumentType[]),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const patchSchema = z
  .object({
    id: z.string().min(1),
    action: z.enum(["publish", "archive"]),
  })
  .strict()

export async function GET(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  const id = new URL(req.url).searchParams.get("id")?.trim()
  if (id) {
    const doc = await prisma.avocatLegalDocument.findUnique({ where: { id } })
    if (!doc) return Response.json({ ok: false, error: "not_found" }, { status: 404 })
    return Response.json({
      ok: true,
      document: {
        id: doc.id,
        type: doc.type,
        title: doc.title,
        version: doc.version,
        status: doc.status,
        markdown: doc.contentMd,
        html: doc.contentHtml,
        preview: doc.contentMd.slice(0, 200),
      },
    })
  }

  try {
    const [documents, letters] = await Promise.all([
      prisma.avocatLegalDocument.findMany({
        orderBy: [{ type: "asc" }, { version: "desc" }],
        take: 50,
      }),
      prisma.legalLetter.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          type: true,
          supplierId: true,
          status: true,
          createdAt: true,
          contentMarkdown: true,
        },
      }),
    ])

    return Response.json({
      ok: true,
      defaults: defaultDocumentData(),
      documents: documents.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        version: d.version,
        status: d.status,
        metadata: d.metadata,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        preview: d.contentMd.slice(0, 200),
        viewUrl: `/dashboard/admin/legal/documents?view=${d.id}`,
      })),
      letters: letters.map((l) => ({
        id: l.id,
        type: l.type,
        supplierId: l.supplierId,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
        preview: l.contentMarkdown.slice(0, 120),
        viewUrl: `/dashboard/admin/legal/lettre/${l.id}`,
      })),
    })
  } catch (error) {
    console.error("[legal:avocat-documents]", {
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
    const defaults = defaultDocumentData()

    let input: GenerateDocumentInput
    switch (body.type) {
      case "cgv":
        input = {
          type: "cgv",
          data: {
            companyName:
              (body.data?.companyName as string | undefined) ?? defaults.cgv.companyName,
            marketplaceName:
              (body.data?.marketplaceName as string | undefined) ?? defaults.cgv.marketplaceName,
          },
        }
        break
      case "cgu":
        input = { type: "cgu", data: {} }
        break
      case "mentions":
        input = {
          type: "mentions",
          data: {
            companyName:
              (body.data?.companyName as string | undefined) ?? defaults.mentions.companyName,
            siret: (body.data?.siret as string | undefined) ?? defaults.mentions.siret,
            adresse: (body.data?.adresse as string | undefined) ?? defaults.mentions.adresse,
          },
        }
        break
      case "contrat_fournisseur":
        input = {
          type: "contrat_fournisseur",
          data: {
            supplierName:
              (body.data?.supplierName as string | undefined) ?? defaults.contrat.supplierName,
            commission: Number(body.data?.commission ?? defaults.contrat.commission),
            companyName:
              (body.data?.companyName as string | undefined) ?? defaults.contrat.companyName,
          },
        }
        break
    }

    const generated = await generateLegalDocument(input)

    const lastVersion = await prisma.avocatLegalDocument.findFirst({
      where: { type: body.type },
      orderBy: { version: "desc" },
      select: { version: true },
    })
    const version = (lastVersion?.version ?? 0) + 1

    const doc = await prisma.avocatLegalDocument.create({
      data: {
        type: body.type,
        title: `${generated.title} v${version}`,
        contentMd: generated.markdown,
        contentHtml: generated.html,
        version,
        status: "draft",
        metadata: (body.data ?? {}) as Prisma.InputJsonValue,
      },
    })

    console.log("[legal:avocat-documents]", {
      stage: "generate",
      id: doc.id,
      type: body.type,
      version,
    })

    return Response.json({
      ok: true,
      document: {
        id: doc.id,
        type: doc.type,
        title: doc.title,
        version: doc.version,
        status: doc.status,
        markdown: doc.contentMd,
        html: doc.contentHtml,
      },
    })
  } catch (error) {
    console.error("[legal:avocat-documents]", {
      stage: "generate",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "generate_failed" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const { id, action } = patchSchema.parse(await req.json())
    const doc = await prisma.avocatLegalDocument.findUnique({ where: { id } })
    if (!doc) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 })
    }

    if (action === "publish") {
      await prisma.$transaction([
        prisma.avocatLegalDocument.updateMany({
          where: { type: doc.type, status: "published", id: { not: id } },
          data: { status: "archived" },
        }),
        prisma.avocatLegalDocument.update({
          where: { id },
          data: { status: "published" },
        }),
      ])
    } else {
      await prisma.avocatLegalDocument.update({
        where: { id },
        data: { status: "archived" },
      })
    }

    console.log("[legal:avocat-documents]", { stage: "patch", id, action })
    return Response.json({ ok: true })
  } catch (error) {
    console.error("[legal:avocat-documents]", {
      stage: "patch",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }
}
