import { DemoChromeSync } from "@/components/demo/demo-chrome-sync"
import { DemoLocaleAnchor } from "@/components/demo/demo-locale-anchor"
import { DemoTopBanner } from "@/components/demo/demo-top-banner"

export default function DemoLabLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoChromeSync />
      <DemoLocaleAnchor />
      <DemoTopBanner />
      <div className="affisell-demo-lab-shell min-h-[calc(100dvh-3.75rem)] bg-gradient-to-b from-zinc-100/90 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/95">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">{children}</div>
      </div>
    </>
  )
}
