import Link from "next/link"
import { Map, ShieldCheck, Sparkles, TrendingUp, Truck, Users, Zap } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RadarCardProps = {
  borderClass: string
  glowClass: string
  icon: ReactNode
  badge: string
  title: string
  bullets: Array<{ icon: ReactNode; text: string }>
}

function RadarKindCard({
  borderClass,
  glowClass,
  icon,
  badge,
  title,
  bullets,
}: RadarCardProps) {
  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-3xl border bg-white/[0.06] p-8 backdrop-blur-xl sm:p-10",
        "shadow-[0_24px_80px_rgba(0,0,0,0.35)] ring-1 ring-white/10",
        borderClass,
        glowClass
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />
      <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-200">
        {badge}
      </span>
      <div className="mt-5 flex items-center gap-3">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-white/10 text-2xl ring-1 ring-white/15">
          {icon}
        </span>
        <h3 className="text-left text-lg font-bold tracking-[0.12em] text-white sm:text-xl">
          {title}
        </h3>
      </div>
      <ul className="mt-8 space-y-5 text-left">
        {bullets.map((bullet) => (
          <li key={bullet.text} className="flex gap-3">
            <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-violet-200 ring-1 ring-white/10">
              {bullet.icon}
            </span>
            <p className="text-sm leading-relaxed text-zinc-200 sm:text-[15px]">{bullet.text}</p>
          </li>
        ))}
      </ul>
    </article>
  )
}

/**
 * Public landing Radar section — Producteur vs Grossiste, conversion-first copy.
 */
export function HomeRadarTeaser({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-violet-400/25",
        "bg-gradient-to-br from-zinc-950 via-violet-950/90 to-emerald-950/50 px-5 py-12 text-white sm:px-10 sm:py-16",
        className
      )}
      aria-labelledby="home-radar-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 size-72 rounded-full bg-violet-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-emerald-500/15 blur-3xl"
      />

      <div className="relative mx-auto max-w-5xl text-center">
        <p className="text-xs font-semibold tracking-[0.28em] text-violet-300 uppercase">
          Affisell Radar — Nouveau
        </p>
        <h2
          id="home-radar-heading"
          className="mx-auto mt-5 max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-4xl sm:leading-[1.15] lg:text-[48px]"
        >
          Deux métiers. Deux Radars. Une même obsession: dominer Google Shopping.
        </h2>
        <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-zinc-300 sm:text-lg">
          Le seul Radar branché sur ton GMC. Pas de bullshit SEO. On te montre qui gagne de
          l&apos;argent sur ton dos, et où est l&apos;argent à prendre.
        </p>
      </div>

      <div className="relative mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2 lg:gap-8">
        <RadarKindCard
          borderClass="border-violet-400/45"
          glowClass="shadow-[0_0_60px_rgba(124,58,237,0.18)]"
          icon={<span aria-hidden>👑</span>}
          badge="Pour les marques qui veulent régner"
          title="RADAR PRODUCTEUR"
          bullets={[
            {
              icon: <Map className="size-4" aria-hidden />,
              text: "Cartographie de ton empire: Vois les annonces qui utilisent tes mots-clés de marque en ce moment sur Google Shopping",
            },
            {
              icon: <ShieldCheck className="size-4" aria-hidden />,
              text: "Police des prix: On t'alerte dès qu'un revendeur baisse sous ton prix plancher",
            },
            {
              icon: <Users className="size-4" aria-hidden />,
              text: "Recrutement d'armée: Les 20 resellers FR qui performent déjà dans ta catégorie, prêts à être signés",
            },
          ]}
        />
        <RadarKindCard
          borderClass="border-emerald-400/45"
          glowClass="shadow-[0_0_60px_rgba(16,185,129,0.16)]"
          icon={<span aria-hidden>⚡</span>}
          badge="Pour les grossistes qui veulent être #1"
          title="RADAR GROSSISTE"
          bullets={[
            {
              icon: <TrendingUp className="size-4 text-emerald-200" aria-hidden />,
              text: "Produits orphelins: >10k recherches/mois, <4 concurrents avec stock FR. C'est toi ou personne.",
            },
            {
              icon: <Truck className="size-4 text-emerald-200" aria-hidden />,
              text: "Le badge qui tue: 'Stock FR 24/48h' = tu passes devant tous les dropshippers. Les resellers te supplient.",
            },
            {
              icon: <Sparkles className="size-4 text-emerald-200" aria-hidden />,
              text: "Marge cachée: On te montre où les Producteurs n'ont PAS de réseau. Tu deviens leur Grossiste officiel.",
            },
          ]}
        />
      </div>

      <div className="relative mx-auto mt-12 flex max-w-2xl flex-col items-center gap-4 text-center">
        <Button asChild variant="bentoAccent" size="lg" className="h-12 min-w-[280px] px-8 text-base">
          <Link href="/dashboard/supplier/onboarding/kind">👉 Activer mon Radar (23 sec)</Link>
        </Button>
        <p className="text-xs text-zinc-400 sm:text-sm">
          127 Fournisseurs actifs. Aucun n&apos;est revenu en arrière.
        </p>
        <Button
          asChild
          variant="ghost"
          size="lg"
          className="text-zinc-200 hover:bg-white/10 hover:text-white"
        >
          <Link href="/radar">Ouvrir le Radar →</Link>
        </Button>
      </div>
    </section>
  )
}
