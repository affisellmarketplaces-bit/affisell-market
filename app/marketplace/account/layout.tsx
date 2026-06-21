import { BentoShell } from "@/components/affisell/bento-ui"
import { BuyerAccountHeaderActions } from "@/components/buyer/buyer-account-header-actions"
import { BuyerAccountSidebar } from "@/components/buyer/buyer-account-sidebar"
import { BuyerAccountNav } from "@/components/buyer-account-nav"
import { auth } from "@/auth"
import { loadBuyerAccountOverview } from "@/lib/buyer-account-overview"

export const dynamic = "force-dynamic"

export default async function MarketplaceBuyerAccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const userId = session?.user?.id
  const email = session?.user?.email

  const overview =
    userId && email
      ? await loadBuyerAccountOverview(userId, email).catch((error) => {
          console.error("[buyer-account-layout]", {
            userId,
            error: error instanceof Error ? error.message : String(error),
          })
          return { orderCount: 0, walletCents: 0, cartItemCount: 0 }
        })
      : { orderCount: 0, walletCents: 0, cartItemCount: 0 }

  return (
    <BentoShell>
      <div className="border-b border-violet-100/80 bg-gradient-to-r from-violet-50/50 via-white to-fuchsia-50/40 dark:border-violet-900/30 dark:from-violet-950/30 dark:via-zinc-950 dark:to-fuchsia-950/20">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
          <div className="hidden lg:block" aria-hidden />
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">
                  Marketplace · Espace client
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Votre espace client
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                  Commandes, portefeuille et panier — réservé aux acheteurs. Les marchands utilisent
                  leur propre tableau de bord.
                </p>
              </div>
              {session?.user ? (
                <BuyerAccountHeaderActions
                  name={session.user.name ?? null}
                  image={session.user.image ?? null}
                />
              ) : null}
            </div>
            <BuyerAccountNav
              orderCount={overview.orderCount}
              cartItemCount={overview.cartItemCount}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 md:px-8 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
        <div className="hidden py-10 lg:block">
          <BuyerAccountSidebar />
        </div>
        <div className="min-w-0 py-10">{children}</div>
      </div>
    </BentoShell>
  )
}
