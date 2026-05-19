import Link from "next/link"
import { redirect } from "next/navigation"
import { CreditCard, ShoppingCart } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { buttonVariants } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS } from "@/lib/marketplace-checkout-discount"
import { formatStoreCurrency, formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

function typeLabel(type: string) {
  if (type === "EARNED") return "Earned"
  if (type === "REDEEMED") return "Used at checkout"
  if (type === "REVERSAL") return "Refund adjustment"
  return type
}

type Props = { searchParams?: Promise<{ welcome?: string }> | { welcome?: string } }

export default async function MarketplaceBuyerWalletPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/signup/customer?callbackUrl=/marketplace/account/wallet")
  }

  const sp = searchParams instanceof Promise ? await searchParams : searchParams
  const showWelcome = sp?.welcome === "1"

  const [user, entries] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { buyerRewardBalanceCents: true },
    }),
    prisma.buyerRewardLedger.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ])

  if (!user) {
    redirect("/login?callbackUrl=/marketplace/account/wallet")
  }

  const balance = user.buyerRewardBalanceCents ?? 0

  return (
    <BentoContainer maxWidth="4xl" className="space-y-8">
      {showWelcome ? (
        <BentoCard className="border-violet-200/80 bg-gradient-to-r from-violet-50/90 to-fuchsia-50/50 dark:border-violet-800/50 dark:from-violet-950/40 dark:to-fuchsia-950/20">
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
            Compte créé — votre cashback apparaît ici dès que le paiement est confirmé.
          </p>
          <p className="mt-1 text-xs text-violet-800/90 dark:text-violet-200/80">
            Utilisez votre solde au prochain achat sur le marketplace (minimum carte {formatStoreCurrency(STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS / 100)}).
          </p>
        </BentoCard>
      ) : null}
      <BentoCard className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <BentoPageHeading
          eyebrow="Rewards"
          title="Store credit"
          description={
            <>
              Cashback and bonuses from partner stores. Use it at checkout on the marketplace (minimum{" "}
              {formatStoreCurrency(STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS / 100)} card payment applies).
            </>
          }
          className="max-w-xl"
        />
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            href="/marketplace/account/orders"
            className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "inline-flex justify-center")}
          >
            <CreditCard className="size-5" aria-hidden />
            My orders
          </Link>
          <Link
            href="/cart"
            className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex justify-center")}
          >
            <ShoppingCart className="size-5" aria-hidden />
            Go to cart
          </Link>
        </div>
      </BentoCard>

      <BentoCard className="border-[#10B981]/25 bg-gradient-to-br from-white/90 to-emerald-50/35 dark:border-emerald-900/40 dark:from-zinc-950/80 dark:to-emerald-950/20">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-emerald-200/90">Current balance</p>
        <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">
          {formatStoreCurrencyFromCents(balance)}
        </p>
      </BentoCard>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Activity</h2>
        {entries.length === 0 ? (
          <BentoCard className="border-dashed text-center text-sm text-gray-600 dark:text-zinc-400">
            No movements yet. Shop listings that offer buyer rewards to build your balance.
          </BentoCard>
        ) : (
          <div className="grid gap-4">
            {entries.map((e) => {
              const isEarn = e.type === "EARNED"
              const isReversal = e.type === "REVERSAL"
              const signed = isEarn ? e.amountCents : isReversal ? -e.amountCents : -e.amountCents
              return (
                <BentoCard key={e.id} className="flex flex-col gap-3 py-5 md:flex-row md:items-center md:justify-between md:py-6">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                      {e.createdAt.toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{typeLabel(e.type)}</p>
                  </div>
                  <p
                    className={cn(
                      "text-right text-lg font-bold tabular-nums tracking-tight md:text-xl",
                      isEarn
                        ? "text-emerald-700 dark:text-emerald-300"
                        : isReversal
                          ? "text-rose-700 dark:text-rose-300"
                          : "text-amber-800 dark:text-amber-200"
                    )}
                  >
                    {signed >= 0 ? "+" : "−"}
                    {formatStoreCurrencyFromCents(Math.abs(signed))}
                  </p>
                </BentoCard>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-center text-sm text-gray-600 dark:text-zinc-400">
        <Link href="/shops/browse" className="font-medium text-[#7C3AED] underline-offset-4 hover:underline">
          Browse marketplace
        </Link>
      </p>
    </BentoContainer>
  )
}
