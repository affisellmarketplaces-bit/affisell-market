"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

const ShipToLanguagePanel = dynamic(
  () => import("@/components/marketplace/ShipToLanguagePanel").then((m) => ({ default: m.ShipToLanguagePanel })),
  { ssr: false }
)

/** Ship to / Language combo — desktop utilities row only (`lg:flex`), mirrors LanguageSwitcherDeferred. */
export function ShipToLanguagePanelDeferred() {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  if (!desktop) return null
  return <ShipToLanguagePanel />
}
