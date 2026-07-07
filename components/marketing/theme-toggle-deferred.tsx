"use client"

import dynamic from "next/dynamic"

import { useIdleMount } from "@/hooks/use-idle-mount"
import { cn } from "@/lib/utils"

const ThemeToggle = dynamic(
  () => import("@/components/marketing/theme-toggle").then((m) => ({ default: m.ThemeToggle })),
  { ssr: false }
)

type Props = {
  className?: string
}

/** Dark/light toggle after idle — keeps next-themes off the critical header path. */
export function ThemeToggleDeferred({ className }: Props) {
  const ready = useIdleMount({ idleTimeoutMs: 2600, fallbackDelayMs: 700 })

  if (!ready) {
    return <span className={cn("inline-block h-9 w-9 shrink-0", className)} aria-hidden />
  }

  return <ThemeToggle className={className} />
}
