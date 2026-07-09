import "server-only"

import type { NextRequest } from "next/server"
import type { JWT } from "next-auth/jwt"

import { findFirstMissingDocumentSlug } from "@/lib/legal/acceptance"
import {
  isLegalGateV2Enabled,
  isLegalGateV2EnabledSync,
} from "@/lib/legal/feature-flags"
import {
  isLegalGateExemptPath,
  isLegalGatedPath,
  legalGateCookieOk,
} from "@/lib/middleware-terms-gate"

function buildReacceptPath(returnPath: string, doc?: string): string {
  const params = new URLSearchParams()
  params.set("returnTo", returnPath)
  if (doc) params.set("doc", doc)
  return `/reaccept-terms?${params.toString()}`
}

export async function checkLegalGate(
  user: { id: string; role: string },
  pathname: string,
  req: NextRequest,
  token: JWT | null
): Promise<string | null> {
  const v2Enabled =
    isLegalGateV2EnabledSync() || (await isLegalGateV2Enabled())

  if (!v2Enabled) return null

  if (isLegalGateExemptPath(pathname)) return null
  if (!isLegalGatedPath(pathname)) return null
  if (legalGateCookieOk(req, token)) return null

  const missing = await findFirstMissingDocumentSlug(user.id, user.role)
  if (!missing) return null

  return buildReacceptPath(pathname, missing)
}
