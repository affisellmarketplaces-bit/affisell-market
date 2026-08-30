"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

import type { FooterGlobalContent } from "@/lib/footer-global-sections"

const FooterDesktopFuture = dynamic(
  () =>
    import("@/components/footer/footer-desktop-future").then((m) => ({
      default: m.FooterDesktopFuture,
    })),
  { ssr: false }
)

type Props = {
  content: FooterGlobalContent
}

/** Desktop footer chrome — not parsed on mobile viewports. */
export function FooterDesktopFutureDeferred({ content }: Props) {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const sync = () => {
      setDesktop(mq.matches)
    }
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  if (!desktop) return null
  return <FooterDesktopFuture content={content} />
}
