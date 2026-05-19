import Link from "next/link"
import { ArrowRight, CreditCard, Package, ShoppingCart, Sparkles } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default function MarketplaceBuyerAccountHomePage() {
  return (
    <BentoContainer maxWidth="4xl" className="space-y-8">
      <BentoPageHeading
        eyebrow="Welcome"
        title="Everything for your purchases"
        description="Track orders, use Affisell store credit at checkout, and manage your cart — all in one place on the marketplace."
        className="max-w-2xl"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <BentoCard className="relative overflow-hidden border-violet-200/60 p-6 dark:border-violet-900/40">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/20 blur-2xl dark:bg-violet-600/20"
            aria-hidden
          />
          <Package className="size-8 text-violet-600 dark:text-violet-400" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">Orders &amp; returns</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            See paid orders, open return cases, and deadlines in one timeline.
          </p>
          <Link
            href="/marketplace/account/orders"
            className={cn(
              buttonVariants({ variant: "bentoAccent", size: "bento" }),
              "mt-6 inline-flex w-full justify-center gap-2 sm:w-auto"
            )}
          >
            Open orders <ArrowRight className="size-4" aria-hidden />
          </Link>
        </BentoCard>

        <BentoCard className="relative overflow-hidden border-emerald-200/60 p-6 dark:border-emerald-900/40">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl dark:bg-emerald-600/15"
            aria-hidden
          />
          <CreditCard className="size-8 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">Store credit</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Cashback from partner listings — redeem automatically at checkout when you are signed in.
          </p>
          <Link
            href="/marketplace/account/wallet"
            className={cn(
              buttonVariants({ variant: "bentoOutline", size: "bento" }),
              "mt-6 inline-flex w-full justify-center gap-2 sm:w-auto"
            )}
          >
            View wallet <ArrowRight className="size-4" aria-hidden />
          </Link>
        </BentoCard>
      </div>

      <BentoCard className="flex flex-col gap-4 border-dashed border-violet-200/80 bg-violet-50/40 p-6 dark:border-violet-800/50 dark:bg-violet-950/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
            <ShoppingCart className="size-6 text-violet-600 dark:text-violet-400" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Your cart</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Guest cart syncs when you sign in before checkout.</p>
          </div>
        </div>
        <Link href="/cart" className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex justify-center")}>
          Go to cart
        </Link>
      </BentoCard>

      <BentoCard className="flex flex-col gap-3 border-zinc-200/80 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
          <div>
            <p className="font-medium text-zinc-900 dark:text-white">New here?</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create a free buyer account — or use Google at checkout. Phone sign-in is on our roadmap.
            </p>
          </div>
        </div>
        <Link
          href="/signup/customer"
          className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "shrink-0 self-start sm:self-center")}
        >
          Create buyer account
        </Link>
      </BentoCard>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/shops/browse" className="font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-400">
          ← Back to marketplace
        </Link>
      </p>
    </BentoContainer>
  )
}
