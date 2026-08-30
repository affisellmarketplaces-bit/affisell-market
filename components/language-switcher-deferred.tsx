"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

const LanguageSwitcher = dynamic(
  () =>
    import("@/components/LanguageSwitcher").then((m) => ({
      default: m.LanguageSwitcher,
    })),
  { ssr: false }
)

/** Locale switcher — desktop utilities row only (`lg:flex`). */
export function LanguageSwitcherDeferred() {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => {
      setDesktop(mq.matches)
    }
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  if (!desktop) return null
  return <LanguageSwitcher />
}
