import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = { searchParams?: { blindOrderId?: string } }

export default function OrderSuccessPage({ searchParams }: Props) {
  const blindOrderId = typeof searchParams?.blindOrderId === "string" ? searchParams.blindOrderId.trim() : ""

  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Thank you</h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        Your payment was submitted successfully. You will receive confirmation by email when the payment is confirmed.
      </p>
      {blindOrderId ? (
        <p className="mt-4 rounded-xl border border-violet-100 bg-violet-50/80 px-3 py-2 text-xs text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100">
          Order reference:{" "}
          <span className="font-mono">
            {blindOrderId.length > 28 ? `${blindOrderId.slice(0, 28)}…` : blindOrderId}
          </span>
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/shops/browse" className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }))}>
          Continue shopping
        </Link>
        <Link href="/marketplace/account/orders" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
          My orders
        </Link>
      </div>
    </main>
  )
}
