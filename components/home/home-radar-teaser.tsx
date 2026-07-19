import Link from "next/link"
import { Rocket, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Public landing teaser — Défense vs Attaque before global footer.
 */
export function HomeRadarTeaser({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-violet-400/30",
        "bg-gradient-to-br from-zinc-950 via-violet-950/80 to-emerald-950/40 px-5 py-10 text-white sm:px-10 sm:py-14",
        className
      )}
      aria-labelledby="home-radar-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-violet-500/20 blur-3xl"
      />
      <div className="relative mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-violet-300 uppercase">
          Affisell Radar
        </p>
        <h2
          id="home-radar-heading"
          className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl"
        >
          Ne devine plus quoi vendre. Le Radar sait.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-300 sm:text-base">
          Intelligence marché GMC pour Producteurs et Stockeurs — un cockpit adapté à ta douleur.
        </p>
      </div>

      <div className="relative mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-violet-400/40 bg-white/5 p-5 backdrop-blur-md">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
            <Shield className="size-5" />
          </span>
          <h3 className="mt-3 text-lg font-semibold">Défense pour Producteurs</h3>
          <p className="mt-2 text-sm text-zinc-300">
            Alertes copie GMC, protection prix reseller, top revendeurs FR — ton bouclier anti-copie.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-400/40 bg-white/5 p-5 backdrop-blur-md">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
            <Rocket className="size-5" />
          </span>
          <h3 className="mt-3 text-lg font-semibold">Attaque pour Stockeurs</h3>
          <p className="mt-2 text-sm text-zinc-300">
            Produits &gt;10k recherches, faible concurrence, badge stock 48h — sourcer ce qui part.
          </p>
        </div>
      </div>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="bentoAccent" size="lg">
          <Link href="/pricing">Voir les plans Radar →</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="border-white/30 bg-transparent text-white hover:bg-white/10"
        >
          <Link href="/radar">Ouvrir le Radar</Link>
        </Button>
      </div>
    </section>
  )
}
