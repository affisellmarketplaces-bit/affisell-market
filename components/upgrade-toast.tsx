"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Props = {
  upgrade?: string
}

export function UpgradeToast({ upgrade }: Props) {
  const router = useRouter()
  const shown = useRef(false)

  useEffect(() => {
    if (shown.current) return
    if (upgrade === "success") {
      shown.current = true
      toast.success("Bienvenue Pro! Vidéos illimitées activées")
      router.replace(window.location.pathname, { scroll: false })
    } else if (upgrade === "cancelled") {
      shown.current = true
      toast.message("Upgrade annulé")
      router.replace(window.location.pathname, { scroll: false })
    }
  }, [upgrade, router])

  return null
}
