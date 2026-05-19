"use client"

import { useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"

/** Fine gradient bar — instant feedback on every route change. */
export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle")
  const [width, setWidth] = useState(0)

  useEffect(() => {
    setPhase("run")
    setWidth(12)
    const t1 = window.setTimeout(() => setWidth(55), 40)
    const t2 = window.setTimeout(() => setWidth(88), 120)
    const t3 = window.setTimeout(() => {
      setWidth(100)
      setPhase("done")
    }, 220)
    const t4 = window.setTimeout(() => setPhase("idle"), 480)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      window.clearTimeout(t4)
    }
  }, [pathname, searchParams])

  if (phase === "idle") return null

  return (
    <div
      role="progressbar"
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[250] h-[3px] overflow-hidden"
    >
      <div
        className={cn(
          "h-full origin-left bg-gradient-to-r from-violet-500 via-fuchsia-500 to-teal-400",
          "shadow-[0_0_16px_rgba(139,92,246,0.55)] transition-[width,opacity] duration-150 ease-out",
          phase === "done" && "opacity-0"
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
