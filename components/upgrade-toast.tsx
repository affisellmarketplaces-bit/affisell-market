"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

type Props = {
  upgrade?: string
  sessionId?: string
}

export function UpgradeToast({ upgrade, sessionId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const shown = useRef(false)

  useEffect(() => {
    if (shown.current || !upgrade) return
    shown.current = true

    if (upgrade === "success") {
      void (async () => {
        try {
          const res = await fetch("/api/stripe/verify-pro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(sessionId ? { sessionId } : {}),
          })
          const data = (await res.json()) as { isPro?: boolean; error?: string }
          if (!res.ok || !data.isPro) {
            throw new Error(data.error ?? "Activation Pro impossible")
          }
          toast.success("Bienvenue Pro ! Vidéos illimitées activées")
        } catch (e) {
          toast.error(
            e instanceof Error
              ? e.message
              : "Paiement reçu — l’activation Pro peut prendre quelques minutes"
          )
        }
        router.replace(pathname)
      })()
      return
    }

    if (upgrade === "cancelled") {
      toast.message("Upgrade annulé")
      router.replace(pathname)
      return
    }

    if (upgrade === "paywall") {
      toast.error("Quota atteint — passez à Pro pour des vidéos illimitées")
      void (async () => {
        try {
          const res = await fetch("/api/stripe/create-checkout", {
            method: "POST",
            credentials: "include",
          })
          const data = (await res.json()) as { url?: string; error?: string }
          if (!res.ok || !data.url) {
            throw new Error(data.error ?? "Impossible de démarrer le paiement")
          }
          window.location.href = data.url
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Échec du checkout Pro")
          router.replace(pathname)
        }
      })()
    }
  }, [upgrade, pathname, router])

  return null
}
