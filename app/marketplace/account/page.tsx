import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, CreditCard, Package, ShoppingCart } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { buttonVariants } from "@/components/ui/button"
import { loadBuyerAccountOverview } from "@/lib/buyer-account-overview"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function MarketplaceBuyerAccountHomePage() {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    redirect("/login?callbackUrl=/marketplace/account")
  }

  const overview = await loadBuyerAccountOverview(session.user.id, session.user.email)
  const walletLabel = formatStoreCurrencyFromCents(overview.walletCents)

  return (
    <BentoContainer maxWidth="4xl" className="space-y-8">
      <div className="space-y-4">
        <BentoPageHeading
          eyebrow="Bienvenue"
          title="Tout pour vos achats"
          description="Suivez vos commandes, utilisez votre portefeuille Affisell au paiement et gérez votre panier — tout au même endroit sur le marketplace."
          className="max-w-2xl"
        />
        <Link
          href="/marketplace"
          className={cn(
            buttonVariants({ variant: "bentoAccent", size: "bento" }),
            "inline-flex w-full justify-center sm:w-auto"
          )}
        >
          Parcourir le marketplace
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {overview.orderCount === 0 ? (
          <BentoCard className="relative overflow-hidden border-violet-200/60 p-6 dark:border-violet-900/40 sm:col-span-2">
            <Package className="size-8 text-violet-600 dark:text-violet-400" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">
              Aucune commande pour l&apos;instant
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Découvrez nos produits tendance et profitez du cashback
            </p>
            <Link
              href="/marketplace"
              className={cn(
                buttonVariants({ variant: "bentoAccent", size: "bento" }),
                "mt-6 inline-flex w-full justify-center gap-2 sm:w-auto"
              )}
            >
              Découvrir les produits <ArrowRight className="size-4" aria-hidden />
            </Link>
          </BentoCard>
        ) : (
          <BentoCard className="relative overflow-hidden border-violet-200/60 p-6 dark:border-violet-900/40">
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/20 blur-2xl dark:bg-violet-600/20"
              aria-hidden
            />
            <Package className="size-8 text-violet-600 dark:text-violet-400" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">
              Commandes &amp; retours
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Consultez vos commandes payées, retours en cours et dates limites
            </p>
            <Link
              href="/marketplace/account/orders"
              className={cn(
                buttonVariants({ variant: "bentoAccent", size: "bento" }),
                "mt-6 inline-flex w-full justify-center gap-2 sm:w-auto"
              )}
            >
              Voir les commandes <ArrowRight className="size-4" aria-hidden />
            </Link>
          </BentoCard>
        )}

        <BentoCard className="relative overflow-hidden border-emerald-200/60 p-6 dark:border-emerald-900/40">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl dark:bg-emerald-600/15"
            aria-hidden
          />
          <CreditCard className="size-8 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">Portefeuille</h2>
          <p className="mt-2 text-sm font-medium tabular-nums text-zinc-900 dark:text-white">
            {walletLabel} disponible
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Cashback sur les produits partenaires — utilisable automatiquement au paiement
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/marketplace/account/wallet"
              className={cn(
                buttonVariants({ variant: "bentoOutline", size: "bento" }),
                "inline-flex justify-center gap-2"
              )}
            >
              Voir le portefeuille <ArrowRight className="size-4" aria-hidden />
            </Link>
            {overview.walletCents === 0 ? (
              <Link
                href="/faq#cashback"
                className="text-center text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300 sm:text-left"
              >
                Comment gagner du cashback ?
              </Link>
            ) : null}
          </div>
        </BentoCard>
      </div>

      {overview.cartItemCount === 0 ? (
        <BentoCard className="flex flex-col gap-4 border-dashed border-violet-200/80 bg-violet-50/40 p-6 dark:border-violet-800/50 dark:bg-violet-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
              <ShoppingCart className="size-6 text-violet-600 dark:text-violet-400" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Votre panier est vide</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Ajoutez des articles depuis le marketplace pour passer commande
              </p>
            </div>
          </div>
          <Link
            href="/marketplace"
            className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }), "inline-flex justify-center")}
          >
            Commencer mes achats
          </Link>
        </BentoCard>
      ) : (
        <BentoCard className="flex flex-col gap-4 border-dashed border-violet-200/80 bg-violet-50/40 p-6 dark:border-violet-800/50 dark:bg-violet-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
              <ShoppingCart className="size-6 text-violet-600 dark:text-violet-400" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Votre panier</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {overview.cartItemCount} article{overview.cartItemCount > 1 ? "s" : ""} en attente
              </p>
            </div>
          </div>
          <Link href="/cart" className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex justify-center")}>
            Voir le panier
          </Link>
        </BentoCard>
      )}

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/marketplace"
          className="font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-400"
        >
          ← Retour au marketplace
        </Link>
      </p>
    </BentoContainer>
  )
}
