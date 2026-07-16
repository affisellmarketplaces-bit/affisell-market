import RadarAppShell from "@/components/radar/radar-app-shell"
import { auth } from "@/lib/auth"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { isRadarEnabled } from "@/lib/radar/gate"
import { getRadarDb } from "@/lib/prisma-radar"

export default async function RadarLayout({ children }: { children: React.ReactNode }) {
  let unreadCount = 0

  if (isRadarEnabled() && resolveRadarDatabaseUrl()) {
    try {
      const session = await auth()
      if (session?.user?.id) {
        unreadCount = await getRadarDb().radarAlert.count({
          where: {
            OR: [{ userId: null }, { userId: session.user.id }],
            read: false,
          },
        })
      }
    } catch (err) {
      console.warn("[radar/layout]", {
        result: "unread_failed",
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  return <RadarAppShell unreadCount={unreadCount}>{children}</RadarAppShell>
}
