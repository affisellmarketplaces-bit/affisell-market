import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { BULL_BOARD_BASE_PATH } from "@/lib/auto-order/bullmq/bull-board-server"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminQueuesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/queues")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Fulfillment queues
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Inspect failed place-order jobs, read stack traces, and retry or promote without deploying
          code. Requires <code className="text-xs">REDIS_URL</code> and the auto-order worker.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={BULL_BOARD_BASE_PATH} className={cn(buttonVariants())}>
            Open Bull Board
          </Link>
          <Link
            href="/admin/reviews"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Review moderation
          </Link>
        </div>

        <ul className="mt-8 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              auto-order:place-supplier-order
            </strong>{" "}
            — live jobs (6 retries, exponential backoff)
          </li>
          <li>
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">
              auto-order:place-supplier-order:dlq
            </strong>{" "}
            — exhausted failures; retry from the DLQ queue in the UI
          </li>
          <li>
            Worker: <code className="text-xs">npm run worker:auto-order</code>
          </li>
        </ul>
      </div>
    </main>
  )
}
