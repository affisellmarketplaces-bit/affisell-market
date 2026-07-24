"use client"

import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"

const HomeWorldRadarInlineInner = dynamic(
  () =>
    import("@/components/home/home-world-radar-inline").then((m) => ({
      default: m.HomeWorldRadarInline,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[4.5rem] rounded-2xl border border-violet-200/40 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20"
        aria-hidden
      />
    ),
  }
)

/** Mobile catalog teaser — deferred so it stays out of the initial home chunk. */
export function HomeWorldRadarInlineLazy({ className }: { className?: string }) {
  return <HomeWorldRadarInlineInner className={cn(className)} />
}
