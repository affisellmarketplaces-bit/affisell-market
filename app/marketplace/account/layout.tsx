import { BentoShell } from "@/components/affisell/bento-ui"
import { BuyerAccountNav } from "@/components/buyer-account-nav"
import { BuyerAccountSignOutButton } from "@/components/buyer-account-sign-out-button"

export default function MarketplaceBuyerAccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <BentoShell>
      <div className="border-b border-violet-100/80 bg-gradient-to-r from-violet-50/50 via-white to-fuchsia-50/40 dark:border-violet-900/30 dark:from-violet-950/30 dark:via-zinc-950 dark:to-fuchsia-950/20">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">
                Marketplace · Buyer space
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Your shopping hub</h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                Orders, store credit, and cart — only for buyer accounts. Merchants use their own dashboard.
              </p>
            </div>
            <div className="shrink-0 self-start sm:pt-1">
              <BuyerAccountSignOutButton />
            </div>
          </div>
          <BuyerAccountNav />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">{children}</div>
    </BentoShell>
  )
}
