"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Props = {
  upgrade?: string
  sessionId?: string
  redirectTo: string
}

export function SupplierUpgradeRedirect({ upgrade, sessionId, redirectTo }: Props) {
  const router = useRouter()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
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
      router.replace(redirectTo)
    })()
  }, [upgrade, sessionId, redirectTo, router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirection…
    </div>
  )
}
