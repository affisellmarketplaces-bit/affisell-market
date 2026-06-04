import type { TermsAcceptanceLogType } from "@/lib/legal-versions"
import { versionForTermsLogType } from "@/lib/legal-versions"
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/request-client-meta"
import { prisma } from "@/lib/prisma"

export async function logTermsAcceptance(
  req: Request,
  userId: string,
  type: TermsAcceptanceLogType
): Promise<void> {
  const version = versionForTermsLogType(type)
  try {
    await prisma.termsAcceptanceLog.create({
      data: {
        userId,
        type,
        version,
        ip: clientIpFromRequest(req),
        userAgent: userAgentFromRequest(req),
      },
    })
    console.log("[terms-acceptance-log]", { userId, type, version, result: "ok" })
  } catch (e) {
    console.error("[terms-acceptance-log]", {
      userId,
      type,
      version,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
