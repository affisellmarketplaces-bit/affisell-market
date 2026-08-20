"use client"

import dynamic from "next/dynamic"

import { useShellIdleMount } from "@/hooks/use-shell-idle-mount"
import { safeDynamicImport } from "@/lib/safe-dynamic-import"
import { cn } from "@/lib/utils"

const ThemeToggle = dynamic(
  () =>
    safeDynamicImport(
      () =>
        import("@/components/marketing/theme-toggle").then((m) => ({
          default: m.ThemeToggle,
        })),
      "ThemeToggle"
    ),
  { ssr: false }
)

type Props = {
  className?: string
}

/** Dark/light toggle after idle — keeps next-themes off the critical header path. */
export function ThemeToggleDeferred({ className }: Props) {
  const ready = useShellIdleMount({ idleTimeoutMs: 2600, fallbackDelayMs: 700 })

  if (!ready) {
    return <span className={cn("inline-block h-9 w-9 shrink-0", className)} aria-hidden />
  }

  return <ThemeToggle className={className} />
}
