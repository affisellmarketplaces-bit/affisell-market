import Link from "next/link"
import { Lock, Radar, Rocket, Shield } from "lucide-react"
import type { ReactNode } from "react"

import {
  RadarPaywallCheckoutButton,
  RadarPaywallCtaButton,
  RadarPaywallViewTracker,
} from "@/components/radar/radar-paywall-tracker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { RadarCheckoutPlanId, RadarPlanId } from "@/lib/radar/plans"
import { radarCheckoutCtaLabel } from "@/lib/radar/pricing-display"
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
  /** From getUserRadarPlan / User.radarPlan resolution. */
  radarPlanId?: RadarPlanId | string | null
  /** Session role — reseller (AFFILIATE) gets Lanceur CTA. */
  role?: string | null
  /** When false (e.g. non-SUPPLIER chrome), still allow affiliate free blur. */
  enabled?: boolean
  children: ReactNode
}

function isFreeRadarPlan(planId: string | null | undefined): boolean {
  return !planId || planId === "free" || planId === "starter"
}

/**
 * Non-breaking Radar chrome: onboarding banner + defense/attaque KPIs + free blur paywall.
 * Wraps existing dashboard content — never replaces GMC/OAuth/scan logic.
 */
export function RadarKindCockpit({
  supplierKind,
  radarPlanId = "free",
  role = null,
  enabled = true,
  children,
}: Props) {
  if (!RADAR_KIND_ENABLED || !enabled) {
    return <>{children}</>
  }

  const cockpit = getRadarCockpit(supplierKind)
  const needsOnboarding = needsSupplierKindOnboarding(supplierKind)
  const free = isFreeRadarPlan(radarPlanId)
  const roleUpper = String(role ?? "").toUpperCase()
  const isReseller = roleUpper === "AFFILIATE"
  const isSupplier = roleUpper === "SUPPLIER"

  const showPaidBlur =
    free &&
    !needsOnboarding &&
    ((isSupplier && supplierKind !== "unset") || isReseller)

  const checkoutPlan: RadarCheckoutPlanId =
    isReseller || supplierKind === "stocker" ? "pro" : "global"

  const paywallTitle = isReseller
    ? "Débloque les opportunités Radar Pro"
    : supplierKind === "producer"
      ? "Débloque la veille défense Radar Global"
      : "Débloque les opportunités sourcing Radar Pro"

  const paywallBody = isReseller
    ? "Les Resellers Radar Pro voient 50 produits/semaine. Tu n'en vois que 3."
    : supplierKind === "producer"
      ? "Radar Global : map mondiale, alertes Slack, détection de copies sur GMC."
      : "Radar Pro : winners live, map, 10 alertes — avant tes concurrents."

  const paywallCta = radarCheckoutCtaLabel(checkoutPlan)

  return (
    <div className="space-y-6">
      {needsOnboarding && isSupplier ? (
        <RadarKindOnboardingBanner supplierKind={supplierKind} cockpit={cockpit} />
      ) : null}

      {supplierKind === "producer" && isSupplier ? (
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

      {supplierKind === "stocker" && isSupplier ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CockpitBadge
              icon={<Rocket className="size-4" />}
              label={`Mode: ${getSupplierKindLabel("stocker")} — Radar Grossiste - Sourcing`}
              tone="attaque"
            />
            <Button asChild variant="bentoAccent" size="sm">
              <Link href="/supplier/products/new">Sourcer un produit</Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard
              title="Opportunités GMC > 10k recherches / <5 concurrents: 12 produits"
              hint="Grossiste — mock UI"
            />
            <KpiCard title="Marge moyenne potentielle: 68%" hint="Estimateur — mock UI" />
          </div>
        </div>
      ) : null}

      {!needsOnboarding && cockpit && isSupplier ? (
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Contexte Radar · cockpit {cockpit} · plan {radarPlanId ?? "free"}
        </p>
      ) : null}

      <div className={cn("relative", (needsOnboarding || showPaidBlur) && "min-h-[280px]")}>
        {needsOnboarding && isSupplier ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1] rounded-xl bg-gradient-to-b from-violet-500/5 to-transparent"
          />
        ) : null}

        <div
          className={cn(
            needsOnboarding && isSupplier && "blur-[0.5px] sm:blur-sm",
            showPaidBlur && "select-none"
          )}
        >
          {children}
        </div>

        {showPaidBlur ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[42%] z-[2]">
            <RadarPaywallViewTracker
              supplierKind={supplierKind}
              cockpit={cockpit}
              needsOnboarding={false}
              surface="paid_blur"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-50/80 to-zinc-50 backdrop-blur-xl dark:via-zinc-950/80 dark:to-zinc-950" />
            <div className="pointer-events-auto relative flex h-full items-center justify-center p-4">
              <Card className="w-full max-w-md border-violet-400/50 bg-white/90 shadow-[0_0_40px_rgba(124,58,237,0.25)] backdrop-blur-xl dark:bg-zinc-950/90">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-violet-500/15 text-[#7C3AED]">
                    <Lock className="size-5" />
                  </div>
                  <CardTitle className="text-lg text-zinc-900 dark:text-white">
                    {paywallTitle}
                  </CardTitle>
                  <CardDescription className="text-sm">{paywallBody}</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-6">
                  <RadarPaywallCheckoutButton
                    plan={checkoutPlan}
                    supplierKind={supplierKind}
                    surface="paid_blur"
                    returnPath="/radar"
                  >
                    {paywallCta}
                  </RadarPaywallCheckoutButton>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function RadarKindOnboardingBanner({
  supplierKind,
  cockpit,
}: {
  supplierKind: SupplierKind
  cockpit: ReturnType<typeof getRadarCockpit>
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-400/40 bg-gradient-to-br from-[#7C3AED] via-violet-600 to-indigo-700 p-5 text-white shadow-[0_0_40px_rgba(124,58,237,0.35)]">
      <RadarPaywallViewTracker
        supplierKind={supplierKind}
        cockpit={cockpit}
        needsOnboarding
        surface="onboarding_banner"
      />
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
              Tu es Producteur ou Grossiste? Configure ton profil pour voir les bonnes opportunités.
            </p>
          </div>
        </div>
        <RadarPaywallCtaButton
          href="/dashboard/supplier/onboarding/kind"
          supplierKind={supplierKind}
          surface="onboarding_banner"
          variant="secondary"
          size="default"
          className="shrink-0 border-0 bg-white text-[#7C3AED] hover:bg-white/90"
        >
          Configurer mon profil →
        </RadarPaywallCtaButton>
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
