import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  collectAcceptedCurrentVersionIds,
  computeUserLegalGateHash,
  findFirstMissingDocumentSlug,
} from "@/lib/legal/acceptance"
import { setLegalOkCookie } from "@/lib/legal/legal-gate-cookie"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const url = new URL(req.url)
  const returnTo = url.searchParams.get("returnTo")?.trim() || "/"
  const role = session.user.role ?? "CUSTOMER"
  const missing = await findFirstMissingDocumentSlug(session.user.id, role)

  if (missing) {
    const redirect = new URL("/reaccept-terms", req.url)
    redirect.searchParams.set("returnTo", returnTo)
    redirect.searchParams.set("doc", missing)
    return NextResponse.redirect(redirect)
  }

  const versionIds = await collectAcceptedCurrentVersionIds(session.user.id, role)
  const gateHash = await computeUserLegalGateHash(session.user.id, role)
  const destination = returnTo.startsWith("/") ? returnTo : `/${returnTo}`
  const res = NextResponse.redirect(new URL(destination, req.url))

  if (gateHash && versionIds.length > 0) {
    setLegalOkCookie(res, versionIds)
  }

  return res
}
