import Link from "next/link"
import { redirect } from "next/navigation"

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

export default async function WalletPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/wallet")
  }

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

  if (!user) redirect("/login?callbackUrl=/dashboard/wallet")

  const balance = user.buyerRewardBalanceCents ?? 0

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Store credit</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Cashback and bonuses from partner stores. Use it at checkout on the marketplace (minimum{" "}
            {formatStoreCurrency(STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS / 100)} card payment applies).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/orders" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            My orders
          </Link>
          <Link href="/cart" className={cn(buttonVariants({ variant: "default", size: "sm" }), "bg-teal-600 hover:bg-teal-700")}>
            Go to cart
          </Link>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50 to-white p-6 shadow-sm dark:border-teal-900/50 dark:from-teal-950/40 dark:to-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">Current balance</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-teal-950 dark:text-teal-50">{formatStoreCurrencyFromCents(balance)}</p>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Activity</h2>
        {entries.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            No movements yet. Shop listings that offer buyer rewards to build your balance.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {entries.map((e) => {
                  const isEarn = e.type === "EARNED"
                  const isReversal = e.type === "REVERSAL"
                  const signed = isEarn ? e.amountCents : isReversal ? -e.amountCents : -e.amountCents
                  return (
                    <tr key={e.id} className="text-zinc-800 dark:text-zinc-200">
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {e.createdAt.toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3">{typeLabel(e.type)}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          isEarn
                            ? "text-teal-700 dark:text-teal-300"
                            : isReversal
                              ? "text-rose-800 dark:text-rose-200"
                              : "text-amber-800 dark:text-amber-200"
                        }`}
                      >
                        {signed >= 0 ? "+" : "−"}
                        {formatStoreCurrencyFromCents(Math.abs(signed))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-500">
        <Link href="/marketplace" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
          Browse marketplace
        </Link>
      </p>
    </div>
  )
}
