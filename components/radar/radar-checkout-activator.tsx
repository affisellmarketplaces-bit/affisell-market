"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

/**
 * After Stripe Radar checkout, success_url lands on /radar?upgrade=success&session_id=…
 * Webhook may lag — verify + refresh JWT so the paywall lifts without re-login.
 */
export function RadarCheckoutActivator() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { update } = useSession()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    const upgrade = searchParams.get("upgrade")?.trim()
    if (!upgrade) return
    handled.current = true

    const sessionId = searchParams.get("session_id")?.trim() ?? undefined
    const cleanPath = pathname.split("?")[0] ?? "/radar"

    if (upgrade === "cancelled") {
      toast.message("Upgrade Radar annulé")
      router.replace(cleanPath)
      return
    }

    if (upgrade !== "success") {
      router.replace(cleanPath)
      return
    }

    void (async () => {
      try {
        const res = await fetch("/api/stripe/verify-radar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(sessionId ? { sessionId } : {}),
        })
        const data = (await res.json()) as {
          radarPlan?: string
          activated?: boolean
          error?: string
        }
        if (!res.ok) {
          throw new Error(data.error ?? "Activation Radar impossible")
        }

        toast.success(
          data.radarPlan === "global"
            ? "Radar Global activé — accès débloqué"
            : "Radar Pro activé — accès débloqué"
        )
        await update()
        router.replace(cleanPath)
        router.refresh()
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : "Paiement reçu — l’activation peut prendre quelques secondes. Recharge la page."
        )
        router.replace(cleanPath)
        router.refresh()
      }
    })()
  }, [pathname, router, searchParams, update])

  return null
}
