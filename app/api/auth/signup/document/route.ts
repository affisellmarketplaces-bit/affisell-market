import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { logBusiness } from "@/lib/business-log"
import { isMerchantDocumentType } from "@/lib/merchant-legal/merchant-legal-status-shared"
import { storeSignupDocumentDraft } from "@/lib/signup-document-storage.server"
import { isValidSignupDraftId } from "@/lib/signup-draft-id"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DRAFT_TTL_MS = 2 * 60 * 60 * 1000

export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "signup-doc",
    limit: 24,
    windowMs: 60 * 60 * 1000,
  })
  if (limited) return limited

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 })
  }

  const draftId = form.get("draftId")?.toString().trim() ?? ""
  const documentType = form.get("documentType")?.toString().trim() ?? ""
  const file = form.get("file")

  if (!isValidSignupDraftId(draftId)) {
    return NextResponse.json({ error: "invalid_draft_id" }, { status: 400 })
  }
  if (!isMerchantDocumentType(documentType)) {
    return NextResponse.json({ error: "invalid_document_type" }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 })
  }

  try {
    const stored = await storeSignupDocumentDraft(draftId, documentType, file)
    const expiresAt = new Date(Date.now() + DRAFT_TTL_MS)

    await prisma.signupDocumentDraft.upsert({
      where: {
        draftId_documentType: { draftId, documentType },
      },
      create: {
        draftId,
        documentType,
        fileUrl: stored.url,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.fileSizeBytes,
        expiresAt,
      },
      update: {
        fileUrl: stored.url,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.fileSizeBytes,
        expiresAt,
      },
    })

    logBusiness("signup-document", { result: "uploaded", draftId, documentType })
    return NextResponse.json({
      ok: true,
      documentType,
      fileUrl: stored.url,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "upload_failed"
    logBusiness("signup-document", { result: "failed", draftId, documentType, error: message })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
