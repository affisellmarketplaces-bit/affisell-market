import "server-only"

import { prisma } from "@/lib/prisma"

export const ALIEXPRESS_SESSION_NOTIF = "ALIEXPRESS_SESSION" as const
const DEDUPE_MS = 24 * 60 * 60 * 1000

type AlertKind = "refresh_failed" | "not_persisted" | "expiring"

const MESSAGES: Record<AlertKind, string> = {
  refresh_failed:
    "AliExpress · le renouvellement automatique de la session DropForge a échoué. Reconnectez AliExpress : /api/aliexpress/oauth/start",
  not_persisted:
    "AliExpress · la session a été renouvelée mais n’a pas pu être enregistrée en base. Reconnectez AliExpress : /api/aliexpress/oauth/start",
  expiring:
    "AliExpress · la session DropForge arrive à expiration. Reconnectez AliExpress avant qu’elle ne coupe les imports : /api/aliexpress/oauth/start",
}

/** In-app alert to every admin (once per 24h per kind) — so a dying session is fixed BEFORE imports break. */
export async function alertAdminsAliExpressSession(kind: AlertKind, detail?: string): Promise<void> {
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
    if (admins.length === 0) return
    const since = new Date(Date.now() - DEDUPE_MS)
    const message = detail ? `${MESSAGES[kind]} (${detail.slice(0, 120)})` : MESSAGES[kind]
    for (const a of admins) {
      const recent = await prisma.notification.findFirst({
        where: {
          userId: a.id,
          type: ALIEXPRESS_SESSION_NOTIF,
          createdAt: { gte: since },
          message: { startsWith: MESSAGES[kind] },
        },
        select: { id: true },
      })
      if (recent) continue
      await prisma.notification.create({
        data: { userId: a.id, type: ALIEXPRESS_SESSION_NOTIF, message },
      })
    }
  } catch (error) {
    console.error("[aliexpress-session-alert]", error instanceof Error ? error.message : String(error))
  }
}
