import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  collectAcceptedCurrentVersionIds,
  computeUserLegalGateHash,
  findFirstMissingDocumentSlug,
  recordLegalAcceptance,
} from "@/lib/legal/acceptance"
import { setLegalOkCookie } from "@/lib/legal/legal-gate-cookie"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    slug?: string
    locale?: string
  }
  const slug = body.slug?.trim()
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 })
  }

  const locale = body.locale?.trim() || (await resolveRequestLocale(undefined))
  const role = session.user.role ?? "CUSTOMER"

  const acceptance = await recordLegalAcceptance({
    userId: session.user.id,
    slug,
    locale: resolveAppLocale(locale),
    context: "REACCEPT_MODAL",
    req,
  })

  if (!acceptance) {
    return NextResponse.json({ error: "acceptance_failed" }, { status: 500 })
  }

  const versionIds = await collectAcceptedCurrentVersionIds(session.user.id, role)
  const gateHash = await computeUserLegalGateHash(session.user.id, role)
  const missing = await findFirstMissingDocumentSlug(session.user.id, role)

  console.log("[legal-api]", {
    route: "acceptance",
    userId: session.user.id,
    slug,
    missing,
    result: "ok",
  })

  const res = NextResponse.json({
    ok: true,
    slug,
    documentVersionId: acceptance.documentVersionId,
    legalGateHash: gateHash,
    missingDocument: missing,
  })

  if (gateHash && versionIds.length > 0) {
    setLegalOkCookie(res, versionIds)
  }

  return res
}
