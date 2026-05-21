import { Suspense } from "react"

import { BentoShell } from "@/components/affisell/bento-ui"
import { SupplierProductsNewShell } from "@/components/supplier/supplier-products-new-shell"

function SupplierNewProductFallback() {
  return (
    <BentoShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <div
          className="relative overflow-hidden rounded-3xl border border-violet-200/50 bg-white/80 p-8 shadow-sm shadow-violet-500/5 ring-1 ring-black/[0.03] backdrop-blur-md dark:border-violet-900/35 dark:bg-zinc-950/70 dark:ring-white/10 sm:p-10"
          aria-busy
          aria-label="Loading supplier workspace"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-[0.18]"
            style={{
              backgroundImage: `
                radial-gradient(ellipse 80% 55% at 15% -10%, rgba(139,92,246,0.22), transparent 50%),
                radial-gradient(ellipse 60% 45% at 92% 8%, rgba(20,184,166,0.14), transparent 45%)
              `,
            }}
            aria-hidden
          />
          <div className="relative flex flex-col items-center justify-center gap-4 py-12 sm:py-16">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-violet-200/70 dark:bg-violet-900/50" />
            <div className="h-4 w-40 max-w-full animate-pulse rounded-full bg-zinc-200/90 dark:bg-zinc-700/80" />
            <div className="h-3 w-56 max-w-full animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800/80" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-300">Loading workspace…</p>
          </div>
        </div>
      </div>
    </BentoShell>
  )
}

export default function SupplierNewProductPage() {
  return (
    <Suspense fallback={<SupplierNewProductFallback />}>
      <SupplierProductsNewShell />
    </Suspense>
  )
}
