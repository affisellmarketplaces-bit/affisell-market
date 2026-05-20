import Link from "next/link"
import { Gift, MessageCircle } from "lucide-react"

import { BentoCard } from "@/components/affisell/bento-ui"

export function BuyerAccountSidebar() {
  return (
    <aside className="hidden w-[300px] shrink-0 space-y-4 lg:block" aria-label="Avantages et support">
      <BentoCard className="border-violet-200/70 bg-gradient-to-br from-violet-50/90 to-fuchsia-50/50 p-5 dark:border-violet-900/50 dark:from-violet-950/40 dark:to-fuchsia-950/20">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <Gift className="size-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Réductions exclusives</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Jusqu&apos;à -70% sur une sélection
            </p>
            <Link
              href="/marketplace"
              className="mt-3 inline-block text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
            >
              Voir les offres →
            </Link>
          </div>
        </div>
      </BentoCard>

      <BentoCard className="border-zinc-200/80 p-5 dark:border-zinc-800">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <MessageCircle className="size-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Support</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Une question ? Contactez-nous
            </p>
            <Link
              href="/contact"
              className="mt-3 inline-block text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
            >
              Nous écrire →
            </Link>
          </div>
        </div>
      </BentoCard>
    </aside>
  )
}
