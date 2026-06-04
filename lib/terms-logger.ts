import { headers } from "next/headers"

import type { TermsAcceptanceLogType } from "@/lib/legal-versions"
import { versionForTermsLogType } from "@/lib/legal-versions"
import { prisma } from "@/lib/prisma"
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/request-client-meta"

async function clientMetaFromHeaders(): Promise<{ ip: string; userAgent: string }> {
  const headersList = await headers()
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip")?.trim() ||
    "unknown"
  const userAgent = headersList.get("user-agent")?.trim().slice(0, 2048) || "unknown"
  return { ip, userAgent }
}

/** Preuve horodatée CGU / CGA / CGS (art. 1366 C. civ.) — IP + user-agent. */
export async function logTermsAcceptance(
  userId: string,
  type: TermsAcceptanceLogType,
  version?: string,
  req?: Request
): Promise<void> {
  const resolvedVersion = version ?? versionForTermsLogType(type)
  const { ip, userAgent } = req
    ? {
        ip: clientIpFromRequest(req),
        userAgent: userAgentFromRequest(req),
      }
    : await clientMetaFromHeaders()

  try {
    await prisma.termsAcceptanceLog.create({
      data: { userId, type, version: resolvedVersion, ip, userAgent },
    })
    console.log("[terms-logger]", { userId, type, version: resolvedVersion, result: "ok" })
  } catch (e) {
    console.error("[terms-logger]", {
      userId,
      type,
      version: resolvedVersion,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

/** Routes API — passe la `Request` pour IP / UA fiables. */
export async function logTermsAcceptanceFromRequest(
  req: Request,
  userId: string,
  type: TermsAcceptanceLogType
): Promise<void> {
  return logTermsAcceptance(userId, type, undefined, req)
}
