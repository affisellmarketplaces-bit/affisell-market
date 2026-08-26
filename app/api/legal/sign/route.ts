import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { readResendDeliveryConfig, sendResendEmail } from "@/lib/emails/resend-delivery"
import { createSigningLink, verifySigningToken } from "@/lib/legal/signature"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const postSchema = z
  .object({
    documentId: z.string().min(1),
    supplierId: z.string().optional(),
    email: z.string().email(),
    signerName: z.string().optional(),
  })
  .strict()

/** Admin — crée lien signature + email Resend si configuré. */
export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const body = postSchema.parse(await req.json())
    const doc = await prisma.avocatLegalDocument.findUnique({ where: { id: body.documentId } })
    if (!doc) {
      return Response.json({ ok: false, error: "document_not_found" }, { status: 404 })
    }

    const link = await createSigningLink(body.documentId, body.email, {
      supplierId: body.supplierId,
      signerName: body.signerName,
      documentHtml: doc.contentHtml,
    })

    const resend = readResendDeliveryConfig()
    let emailSent = false

    if (resend) {
      const result = await sendResendEmail({
        context: "legal-signing",
        intendedTo: body.email,
        config: resend,
        subject: `Affisell — Signature requise : ${doc.title}`,
        html: `<p>Bonjour${body.signerName ? ` ${body.signerName}` : ""},</p>
<p>Veuillez signer le document <strong>${doc.title}</strong> sur Affisell Market.</p>
<p><a href="${link.signingUrl}">Signer le document</a></p>
<p>Ce lien expire le ${new Date(link.expiresAt).toLocaleDateString("fr-FR")}.</p>`,
      })
      emailSent = result.ok
    } else {
      console.log("[legal:sign]", {
        result: "email_skipped",
        reason: "RESEND_API_KEY missing",
        signingUrl: link.signingUrl,
      })
    }

    console.log("[legal:sign]", {
      result: "link_created",
      documentId: body.documentId,
      email: body.email,
      provider: link.provider,
      emailSent,
    })

    return Response.json({ ok: true, ...link, emailSent })
  } catch (error) {
    console.error("[legal:sign]", {
      stage: "create",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }
}

/** Public — vérifie token et retourne document pour signature. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim()
  if (!token) {
    return Response.json({ ok: false, error: "token_required" }, { status: 400 })
  }

  const verified = await verifySigningToken(token)
  if (!verified.ok) {
    return Response.json({ ok: false, error: verified.error }, { status: 404 })
  }

  const { signing } = verified
  return Response.json({
    ok: true,
    token,
    signerEmail: signing.signerEmail,
    signerName: signing.signerName,
    expiresAt: signing.expiresAt.toISOString(),
    document: {
      id: signing.document.id,
      title: signing.document.title,
      html: signing.document.contentHtml,
      markdown: signing.document.contentMd,
    },
  })
}
