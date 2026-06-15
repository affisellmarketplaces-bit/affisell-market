import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { logBusiness } from "@/lib/business-log"
import {
  clearSignupDrafts,
  loadSignupDrafts,
  persistMerchantLegalProfile,
} from "@/lib/merchant-legal/persist-merchant-legal-profile"
import { validateMerchantSignupPayload } from "@/lib/merchant-legal/validate-merchant-signup"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = {
  signupDraftId?: string
  legalStatus?: string
  legalEntityName?: string
  tradeName?: string
  siret?: string
  vatNumber?: string
  rnaNumber?: string
  countryCode?: string
}

/** Logged-in supplier / affiliate — submit KYC dossier after signup. */
export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  const role = session?.user?.role

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const existing = await prisma.merchantLegalProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: "profile_exists" }, { status: 409 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const draftId = body.signupDraftId?.trim() ?? ""
  if (!draftId) {
    return NextResponse.json({ error: "signup_draft_required" }, { status: 400 })
  }

  const drafts = await loadSignupDrafts(draftId)
  const validated = validateMerchantSignupPayload(
    role,
    {
      legalStatus: body.legalStatus ?? "",
      legalEntityName: body.legalEntityName,
      tradeName: body.tradeName,
      siret: body.siret,
      vatNumber: body.vatNumber,
      rnaNumber: body.rnaNumber,
      countryCode: body.countryCode,
    },
    drafts.map((d) => ({ documentType: d.documentType, fileUrl: d.fileUrl }))
  )

  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const draftByType = new Map(drafts.map((d) => [d.documentType, d]))

  await persistMerchantLegalProfile({
    userId,
    legalStatus: validated.data.legalStatus,
    legalEntityName: validated.data.legalEntityName,
    tradeName: validated.data.tradeName,
    siret: validated.data.siret,
    vatNumber: validated.data.vatNumber,
    rnaNumber: validated.data.rnaNumber,
    countryCode: validated.data.countryCode,
    documents: validated.data.documents.map((d) => {
      const draft = draftByType.get(d.documentType)
      return {
        documentType: d.documentType,
        fileUrl: d.fileUrl,
        fileName: draft?.fileName ?? null,
        mimeType: draft?.mimeType ?? null,
        fileSizeBytes: draft?.fileSizeBytes ?? null,
      }
    }),
  })

  await clearSignupDrafts(draftId)

  logBusiness("merchant-legal", {
    userId,
    role,
    result: "profile_submitted",
    legalStatus: validated.data.legalStatus,
  })

  return NextResponse.json({ ok: true })
}
