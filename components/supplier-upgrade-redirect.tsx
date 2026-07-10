"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

type Props = {
  upgrade?: string
  sessionId?: string
  redirectTo: string
}

export function SupplierUpgradeRedirect({ upgrade, sessionId, redirectTo }: Props) {
  const { replace, mounted } = useSafeAppRouter()
  const done = useRef(false)

  useEffect(() => {
    if (!mounted || done.current) return
    done.current = true

    void (async () => {
      if (upgrade === "success") {
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
      } else if (upgrade === "cancelled") {
        toast.message("Upgrade annulé")
      }
      replace(redirectTo)
    })()
  }, [mounted, upgrade, sessionId, redirectTo, replace])

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirection…
    </div>
  )
}
