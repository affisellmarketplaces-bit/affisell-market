"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { isDemoLabRoute } from "@/lib/demo/demo-routes"

const BODY_DEMO_CLASS = "affisell-demo-lab"

/** Hides global footer and tunes chrome on /demo/* routes. */
export function DemoChromeSync() {
  const pathname = usePathname() ?? ""

  useEffect(() => {
    const on = isDemoLabRoute(pathname)
    document.body.classList.toggle(BODY_DEMO_CLASS, on)
    return () => {
      document.body.classList.remove(BODY_DEMO_CLASS)
    }
  }, [pathname])

  return null
}
