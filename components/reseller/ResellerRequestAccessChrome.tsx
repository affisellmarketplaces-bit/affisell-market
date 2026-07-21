"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { GlobalRequestButton } from "@/components/reseller/GlobalRequestButton"

function isResellerSurface(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/affiliate") ||
    pathname.startsWith("/dashboard/reseller") ||
    pathname === "/radar" ||
    pathname.startsWith("/radar/")
  )
}

/**
 * FAB (mobile) + Ctrl/Cmd+N shortcut on reseller surfaces.
 * Mounted from dashboard layout — path-gated, zero break for suppliers.
 */
export function ResellerRequestAccessChrome() {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const active = isResellerSurface(pathname)

  useEffect(() => {
    if (!active) return
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "n") return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      router.push("/dashboard/reseller/requests/new")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, router])

  if (!active) return null

  return <GlobalRequestButton variant="fab" />
}
