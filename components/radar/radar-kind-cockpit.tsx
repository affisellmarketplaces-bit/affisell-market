import Link from "next/link"
import { Radar, Rocket, Shield } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  getRadarCockpit,
  getSupplierKindLabel,
  needsSupplierKindOnboarding,
  type SupplierKind,
} from "@/lib/supplier-kind"
import { cn } from "@/lib/utils"

/** Feature flag — set false to disable cockpit chrome without reverting page logic. */
export const RADAR_KIND_ENABLED = true

type Props = {
  supplierKind: SupplierKind
  /** When false (e.g. non-SUPPLIER), render children only. */
  enabled?: boolean
  children: ReactNode
}

/**
 * Non-breaking Radar chrome: onboarding banner + defense/attaque KPIs.
 * Wraps existing dashboard content — never replaces GMC/OAuth/scan logic.
 */
export function RadarKindCockpit({ supplierKind, enabled = true, children }: Props) {
  if (!RADAR_KIND_ENABLED || !enabled) {
    return <>{children}</>
  }

  const cockpit = getRadarCockpit(supplierKind)
  const needsOnboarding = needsSupplierKindOnboarding(supplierKind)

  return (
    <div className="space-y-6">
      {needsOnboarding ? <RadarKindOnboardingBanner /> : null}

      {supplierKind === "producer" ? (
        <div className="space-y-4">
          <CockpitBadge
            icon={<Shield className="size-4" />}
            label={`Mode: ${getSupplierKindLabel("producer")} — Cockpit Défense`}
            tone="defense"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard
              title="Tes produits listés par X resellers"
              hint="Réseau affiliate — métrique live à brancher"
            />
            <KpiCard
              title="Alerte copie: 3 produits similaires détectés sur GMC"
              hint="Veille défense — mock UI"
            />
          </div>
        </div>
      ) : null}

      {supplierKind === "stocker" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CockpitBadge
              icon={<Rocket className="size-4" />}
              label={`Mode: ${getSupplierKindLabel("stocker")} — Cockpit Attaque`}
              tone="attaque"
            />
            <Button asChild variant="bentoAccent" size="sm">
              <Link href="/supplier/products/new">Sourcer un produit</Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard
              title="Opportunités GMC > 10k recherches / <5 concurrents: 12 produits"
              hint="Attaque — mock UI"
            />
            <KpiCard title="Marge moyenne potentielle: 68%" hint="Estimateur — mock UI" />
          </div>
        </div>
      ) : null}

      {!needsOnboarding && cockpit ? (
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Contexte Radar · cockpit {cockpit}
        </p>
      ) : null}

      <div className={cn(needsOnboarding && "relative")}>
        {needsOnboarding ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1] rounded-xl bg-gradient-to-b from-violet-500/5 to-transparent"
          />
        ) : null}
        <div className={cn(needsOnboarding && "blur-[0.5px] sm:blur-sm")}>{children}</div>
      </div>
    </div>
  )
}

function RadarKindOnboardingBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-400/40 bg-gradient-to-br from-[#7C3AED] via-violet-600 to-indigo-700 p-5 text-white shadow-[0_0_40px_rgba(124,58,237,0.35)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/10 blur-2xl"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <Radar className="size-5" />
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight">Débloque ton Radar adapté</p>
            <p className="mt-1 max-w-xl text-sm text-white/85">
              Tu es Producteur ou Stockeur? Configure ton profil pour voir les bonnes opportunités.
            </p>
          </div>
        </div>
        <Button
          asChild
          variant="secondary"
          className="shrink-0 border-0 bg-white text-[#7C3AED] hover:bg-white/90"
        >
          <Link href="/dashboard/supplier/onboarding/kind">Configurer mon profil →</Link>
        </Button>
      </div>
    </div>
  )
}

function CockpitBadge({
  icon,
  label,
  tone,
}: {
  icon: ReactNode
  label: string
  tone: "defense" | "attaque"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
        tone === "defense"
          ? "bg-emerald-500/10 text-emerald-800 ring-emerald-500/30 dark:text-emerald-300"
          : "bg-orange-500/10 text-orange-900 ring-orange-500/30 dark:text-orange-300"
      )}
    >
      {icon}
      {label}
    </span>
  )
}

function KpiCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/70">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
    </div>
  )
}
