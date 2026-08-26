import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { generateDsaAckEmail, generateTransparencyLog } from "@/lib/legal/dsa"
import { createProof } from "@/lib/legal/proof"
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"
import { prisma } from "@/lib/prisma"
import { sendDsaUrgentSlackAlert } from "@/lib/slack/send-dsa-urgent-alert"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const postSchema = z
  .object({
    productId: z.string().optional(),
    supplierId: z.string().optional(),
    reporterEmail: z.string().email(),
    type: z.enum(["illicite", "contrefacon", "dangereux", "trompeur", "autre"]),
    description: z.string().min(20).max(10_000),
    proofUrls: z.array(z.string().url()).max(10).optional(),
    productUrl: z.string().url().optional(),
  })
  .strict()

const patchSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(["reviewing", "action_taken", "rejected"]),
    actionTaken: z.string().min(5).max(5000).optional(),
  })
  .strict()

function extractProductIdFromUrl(url?: string): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    const marketplace = parsed.pathname.match(/\/marketplace\/([^/?]+)/)
    if (marketplace?.[1]) return marketplace[1]
    const shops = parsed.pathname.match(/\/shops\/[^/]+\/([^/?]+)/)
    if (shops?.[1]) return shops[1]
  } catch {
    return undefined
  }
  return undefined
}

/** Public POST — point de contact DSA art. 16 */
export async function POST(req: Request) {
  try {
    const body = postSchema.parse(await req.json())
    const productId = body.productId ?? extractProductIdFromUrl(body.productUrl)

    const report = await prisma.dsaReport.create({
      data: {
        productId: productId ?? null,
        supplierId: body.supplierId ?? null,
        reporterEmail: body.reporterEmail.trim(),
        type: body.type,
        description: body.description.trim(),
        proofUrls: body.proofUrls ?? [],
        status: "new",
      },
    })

    const proof = await createProof({
      productId: productId ?? null,
      action: "dsa_report",
      payload: {
        reportId: report.id,
        type: body.type,
        reporterEmail: body.reporterEmail,
        description: body.description.slice(0, 500),
        proofUrls: body.proofUrls ?? [],
      },
    })

    await sendDsaUrgentSlackAlert(report)

    const ack = generateDsaAckEmail({
      id: report.id,
      type: report.type,
      reporterEmail: report.reporterEmail,
      description: report.description,
      productId: report.productId,
      createdAt: report.createdAt,
    })

    const resend = readResendDeliveryConfig()
    if (resend) {
      await sendResendEmail({
        context: "dsa-report-ack",
        intendedTo: report.reporterEmail,
        config: resend,
        subject: ack.subject,
        html: ack.html,
      })
    } else {
      console.log("[legal:dsa-report]", {
        result: "email_skipped",
        reportId: report.id,
        reason: "RESEND_API_KEY missing",
      })
    }

    console.log("[legal:dsa-report]", {
      result: "created",
      reportId: report.id,
      type: body.type,
      hash: proof.hash.slice(0, 16),
    })

    return Response.json({
      ok: true,
      reportId: report.id,
      message:
        "Signalement reçu. Vous recevrez une réponse sous 24 h conformément à l'art. 16 du Règlement (UE) 2022/2065 (DSA).",
    })
  } catch (error) {
    console.error("[legal:dsa-report]", {
      stage: "create",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const isPublic = url.searchParams.get("public") === "true"

  if (isPublic) {
    const log = await generateTransparencyLog()
    return Response.json({ ok: true, transparency: log })
  }

  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  const status = url.searchParams.get("status")?.trim()
  const reports = await prisma.dsaReport.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return Response.json({ ok: true, reports })
}

export async function PATCH(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const body = patchSchema.parse(await req.json())
    const existing = await prisma.dsaReport.findUnique({ where: { id: body.id } })
    if (!existing) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 })
    }

    const report = await prisma.dsaReport.update({
      where: { id: body.id },
      data: {
        status: body.status,
        actionTaken: body.actionTaken ?? existing.actionTaken,
        reviewedAt: new Date(),
      },
    })

    if (body.status === "action_taken" && body.actionTaken) {
      await createProof({
        productId: report.productId,
        action: "dsa_report",
        payload: {
          reportId: report.id,
          status: body.status,
          actionTaken: body.actionTaken,
          reviewedAt: new Date().toISOString(),
        },
      })
    }

    console.log("[legal:dsa-report]", {
      result: "updated",
      reportId: report.id,
      status: body.status,
    })

    return Response.json({ ok: true, report })
  } catch (error) {
    console.error("[legal:dsa-report]", {
      stage: "patch",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }
}
