"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Props = {
  upgrade?: string
  redirectTo: string
}

export function SupplierUpgradeRedirect({ upgrade, redirectTo }: Props) {
  const router = useRouter()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    if (upgrade === "success") {
      toast.success("Bienvenue Pro! Vidéos illimitées activées")
    } else if (upgrade === "cancelled") {
      toast.message("Upgrade annulé")
    }
    router.replace(redirectTo)
  }, [upgrade, redirectTo, router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirection…
    </div>
  )
}
