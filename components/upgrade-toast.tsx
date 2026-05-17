"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

type Props = {
  upgrade?: string
}

export function UpgradeToast({ upgrade }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const shown = useRef(false)

  useEffect(() => {
    if (shown.current || !upgrade) return
    shown.current = true
    if (upgrade === "success") {
      toast.success("Bienvenue Pro! Vidéos illimitées activées")
    } else if (upgrade === "cancelled") {
      toast.message("Upgrade annulé")
    }
    router.replace(pathname)
  }, [upgrade, pathname, router])

  return null
}
