"use client"

import Link from "next/link"
import {
  AppWindow,
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  Layers,
  LayoutGrid,
  Palette,
  Sparkles,
  Store,
  UserRound,
} from "lucide-react"
import { useTranslations } from "next-intl"
import type { LucideIcon } from "lucide-react"

import { STOREFRONT_THEME_PRESETS } from "@/lib/storefront-theme-presets"
import {
  BRAND_STUDIO_OPTION_MATRIX,
  BOUTIQUE_SHOWCASE_THEME_REFS,
  buildStorefrontFormatTestLinks,
  STOREFRONT_FORMAT_CATALOG,
  type StorefrontFormatAudience,
  type StorefrontFormatDefinition,
  type StorefrontFormatId,
  type StorefrontFormatsLabSlugs,
} from "@/lib/storefront/storefront-formats-catalog-shared"
import { cn } from "@/lib/utils"

const FORMAT_ICONS: Record<StorefrontFormatId, LucideIcon> = {
  "brand-studio-shops": Store,
  "boutique-procedural": Sparkles,
  "supplier-storefront": LayoutGrid,
  "legion-profile": UserRound,
  "embed-widget": AppWindow,
}

const AUDIENCE_STYLES: Record<StorefrontFormatAudience, string> = {
  buyer: "bg-cyan-500/15 text-cyan-700 ring-cyan-500/30 dark:text-cyan-300",
  affiliate: "bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300",
  supplier: "bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-200",
  creator: "bg-fuchsia-500/15 text-fuchsia-700 ring-fuchsia-500/30 dark:text-fuchsia-300",
}

type Props = {
  slugs: StorefrontFormatsLabSlugs
}

export function StorefrontFormatsLab({ slugs }: Props) {
  const t = useTranslations("demoLab.storefrontFormats")

  return (
    <div className="space-y-10 pb-16">
      <header className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-zinc-950 via-indigo-950/90 to-zinc-900 px-6 py-10 text-white sm:px-10 sm:py-12">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(139,92,246,0.35),transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(34,211,238,0.18),transparent_45%)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:32px_32px]" aria-hidden />
        <Link
          href="/demo"
          className="relative inline-flex items-center gap-1.5 text-xs font-medium text-violet-300/90 transition hover:text-white"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {t("backToDemo")}
        </Link>
        <p className="relative mt-6 text-[10px] font-semibold uppercase tracking-[0.35em] text-violet-300">
          {t("eyebrow")}
        </p>
        <h1 className="relative mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="relative mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          {t("subtitle")}
        </p>
        <dl className="relative mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label={t("stats.formats")} value={String(STOREFRONT_FORMAT_CATALOG.length)} />
          <Stat label={t("stats.boutiqueSkins")} value="1 024" />
          <Stat label={t("stats.brandPresets")} value={String(STOREFRONT_THEME_PRESETS.length)} hint={t("stats.presetsHint")} />
        </dl>
      </header>

      <section aria-labelledby="formats-architecture">
        <div className="mb-5 flex items-center gap-2">
          <Layers className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
          <h2 id="formats-architecture" className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            {t("architectureTitle")}
          </h2>
        </div>
        <div className="rounded-2xl border border-zinc-200/90 bg-white/80 p-4 font-mono text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 sm:p-6 sm:text-xs">
          <pre className="overflow-x-auto whitespace-pre">{t("architectureDiagram")}</pre>
        </div>
      </section>

      <section aria-labelledby="formats-grid">
        <h2 id="formats-grid" className="sr-only">
          {t("formatsGridTitle")}
        </h2>
        <ul className="grid gap-5 lg:grid-cols-2">
          {STOREFRONT_FORMAT_CATALOG.map((format) => (
            <FormatCard key={format.id} format={format} slugs={slugs} />
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="brand-studio-matrix"
        className="rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-white to-violet-50/40 p-6 dark:border-zinc-800 dark:from-zinc-950 dark:to-violet-950/20 sm:p-8"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Palette className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id="brand-studio-matrix" className="text-lg font-bold text-zinc-900 dark:text-white">
              {t("matrixTitle")}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("matrixBody")}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MatrixItem label={t("matrix.layouts")} values={BRAND_STUDIO_OPTION_MATRIX.layouts} />
          <MatrixItem label={t("matrix.heroes")} values={BRAND_STUDIO_OPTION_MATRIX.heroStyles} />
          <MatrixItem label={t("matrix.surfaces")} values={BRAND_STUDIO_OPTION_MATRIX.surfaces} />
          <MatrixItem label={t("matrix.sections")} values={[...BRAND_STUDIO_OPTION_MATRIX.homepageSections]} />
        </dl>
        <p className="mt-5 text-xs text-zinc-500 dark:text-zinc-400">
          {t("matrixBoutiqueNote", { count: BOUTIQUE_SHOWCASE_THEME_REFS.length })}
        </p>
      </section>

      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{t("footerNote")}</p>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
      {hint ? <dd className="mt-0.5 text-[10px] text-zinc-500">{hint}</dd> : null}
    </div>
  )
}

function MatrixItem({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {v}
          </span>
        ))}
      </dd>
    </div>
  )
}

function FormatCard({
  format,
  slugs,
}: {
  format: StorefrontFormatDefinition
  slugs: StorefrontFormatsLabSlugs
}) {
  const t = useTranslations("demoLab.storefrontFormats")
  const Icon = FORMAT_ICONS[format.id]
  const links = buildStorefrontFormatTestLinks(format.id, slugs)

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm transition hover:border-violet-300/80 hover:shadow-lg hover:shadow-violet-500/5 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-700/60">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-0 transition group-hover:opacity-100" aria-hidden />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/15 to-indigo-500/10 text-violet-700 dark:from-violet-500/20 dark:to-indigo-500/10 dark:text-violet-300">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {format.tier === "primary" ? t("tierPrimary") : t("tierChannel")}
          </span>
        </div>
        <h3 className="mt-4 text-lg font-bold text-zinc-900 dark:text-white">
          {t(`formats.${format.id}.title`)}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {t(`formats.${format.id}.role`)}
        </p>
        <p className="mt-3 font-mono text-[11px] text-violet-700 dark:text-violet-300">
          {format.routePattern}
        </p>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {format.audiences.map((audience) => (
            <li key={audience}>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                  AUDIENCE_STYLES[audience]
                )}
              >
                {t(`audiences.${audience}`)}
              </span>
            </li>
          ))}
        </ul>
        {format.optionCounts.proceduralSkins || format.optionCounts.presets ? (
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            {format.optionCounts.proceduralSkins
              ? t("optionCountSkins", { count: format.optionCounts.proceduralSkins })
              : null}
            {format.optionCounts.presets
              ? t("optionCountBrandStudio", {
                  layouts: format.optionCounts.layouts ?? 0,
                  heroes: format.optionCounts.heroStyles ?? 0,
                  presets: format.optionCounts.presets ?? 0,
                })
              : null}
          </p>
        ) : null}
        <ul className="mt-6 space-y-2 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          {links.map((link) => (
            <li key={link.id}>
              {link.disabled ? (
                <span
                  className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-400 dark:border-zinc-700"
                  title={link.disabledReasonKey ? t(link.disabledReasonKey) : undefined}
                >
                  {t(link.labelKey, { theme: link.href.includes("theme=") ? link.href.split("theme=")[1] : "" })}
                  <span className="shrink-0 text-[10px] uppercase">{t("linkDisabled")}</span>
                </span>
              ) : (
                <Link
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:border-violet-300 hover:bg-violet-50/80 hover:text-violet-900 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:border-violet-700 dark:hover:bg-violet-950/30 dark:hover:text-violet-200"
                >
                  <span>
                    {link.id.startsWith("boutique-theme-")
                      ? t("links.boutiqueTheme", {
                          theme: decodeURIComponent(link.href.split("theme=")[1] ?? ""),
                        })
                      : t(link.labelKey)}
                  </span>
                  {link.external ? (
                    <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
                  ) : (
                    <ArrowUpRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
                  )}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}
