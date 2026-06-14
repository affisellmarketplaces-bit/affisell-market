"use client"

import Link from "next/link"
import { ExternalLink, Palette, Save, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import type { FormEvent } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { StoreCustomDomainCard } from "@/components/storefront/store-custom-domain-card"
import { StorefrontLayoutControls } from "@/components/storefront/storefront-layout-controls"
import { StorefrontLivePreview } from "@/components/storefront/storefront-live-preview"
import { StorefrontLogoField } from "@/components/storefront/storefront-logo-field"
import { StorefrontThemePresetPicker } from "@/components/storefront/storefront-theme-preset-picker"
import { StoreLiveUrlCard } from "@/components/storefront/store-live-url-card"
import { StoreNameBadgePicker } from "@/components/storefront/store-name-badge-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DEFAULT_STORE_NAME_BADGE,
  type StoreNameBadgeStyle,
} from "@/lib/store-name-badge-styles"
import {
  DEFAULT_STOREFRONT_THEME,
  parseStorefrontTheme,
  type StorefrontGridDensity,
  type StorefrontHeaderBrandAlign,
  type StorefrontHeroStyle,
  type StorefrontLayoutMode,
  type StorefrontSurface,
  type StorefrontTheme,
} from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type MerchantRole = "AFFILIATE" | "SUPPLIER"

type StoreRow = {
  name: string
  slug: string
  logoUrl: string | null
  bannerUrl: string | null
  description: string | null
  storefrontTheme?: unknown
}

type BrandStudioSnapshot = {
  name: string
  description: string
  bannerUrl: string
  logoUrl: string
  primaryHex: string
  accent: string
  nameBadge: StoreNameBadgeStyle
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  gridDensity: StorefrontGridDensity
  surface: StorefrontSurface
  headerBrandAlign: StorefrontHeaderBrandAlign
  presetId: string | null
}

const BRAND_STUDIO_FORM_ID = "brand-studio-form"

function snapshotFromStore(st: StoreRow): BrandStudioSnapshot {
  const theme = parseStorefrontTheme(st.storefrontTheme)
  return {
    name: st.name,
    description: st.description ?? "",
    bannerUrl: st.bannerUrl ?? "",
    logoUrl: st.logoUrl ?? "",
    primaryHex: theme.primary ?? DEFAULT_STOREFRONT_THEME.primary!,
    accent: theme.accent ?? DEFAULT_STOREFRONT_THEME.accent!,
    nameBadge: theme.nameBadge ?? DEFAULT_STORE_NAME_BADGE,
    layout: theme.layout ?? DEFAULT_STOREFRONT_THEME.layout!,
    heroStyle: theme.heroStyle ?? DEFAULT_STOREFRONT_THEME.heroStyle!,
    gridDensity: theme.gridDensity ?? DEFAULT_STOREFRONT_THEME.gridDensity!,
    surface: theme.surface ?? DEFAULT_STOREFRONT_THEME.surface!,
    headerBrandAlign: theme.headerBrandAlign ?? DEFAULT_STOREFRONT_THEME.headerBrandAlign!,
    presetId: theme.presetId ?? null,
  }
}

function snapshotFromDraft(input: {
  name: string
  description: string
  bannerUrl: string
  logoUrl: string
  primaryHex: string
  accent: string
  nameBadge: StoreNameBadgeStyle
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  gridDensity: StorefrontGridDensity
  surface: StorefrontSurface
  headerBrandAlign: StorefrontHeaderBrandAlign
  presetId: string | null
}): BrandStudioSnapshot {
  return {
    name: input.name.trim().slice(0, 40),
    description: input.description.trim(),
    bannerUrl: input.bannerUrl.trim(),
    logoUrl: input.logoUrl.trim(),
    primaryHex: input.primaryHex,
    accent: input.accent,
    nameBadge: input.nameBadge,
    layout: input.layout,
    heroStyle: input.heroStyle,
    gridDensity: input.gridDensity,
    surface: input.surface,
    headerBrandAlign: input.headerBrandAlign,
    presetId: input.presetId,
  }
}

function snapshotsEqual(a: BrandStudioSnapshot, b: BrandStudioSnapshot): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.bannerUrl === b.bannerUrl &&
    a.logoUrl === b.logoUrl &&
    a.primaryHex === b.primaryHex &&
    a.accent === b.accent &&
    a.nameBadge === b.nameBadge &&
    a.layout === b.layout &&
    a.heroStyle === b.heroStyle &&
    a.gridDensity === b.gridDensity &&
    a.surface === b.surface &&
    a.headerBrandAlign === b.headerBrandAlign &&
    a.presetId === b.presetId
  )
}

type Props = {
  role: MerchantRole
  previewHref: string
  profileHref: string
  profileLabel: string
}

export function MerchantBrandStudio({ role, previewHref, profileHref, profileLabel }: Props) {
  const t = useTranslations("storefront.brandStudio")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [publicStoreUrl, setPublicStoreUrl] = useState<string | null>(null)
  const [storeUrls, setStoreUrls] = useState<{
    primaryUrl: string
    subdomainUrl: string
    platformPathUrl: string
    customDomainUrl: string | null
  } | null>(null)
  const [storeHostSuffix, setStoreHostSuffix] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [description, setDescription] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [accent, setAccent] = useState(DEFAULT_STOREFRONT_THEME.accent!)
  const [primaryHex, setPrimaryHex] = useState(DEFAULT_STOREFRONT_THEME.primary!)
  const [nameBadge, setNameBadge] = useState<StoreNameBadgeStyle>(DEFAULT_STORE_NAME_BADGE)
  const [layout, setLayout] = useState<StorefrontLayoutMode>(DEFAULT_STOREFRONT_THEME.layout!)
  const [heroStyle, setHeroStyle] = useState<StorefrontHeroStyle>(DEFAULT_STOREFRONT_THEME.heroStyle!)
  const [gridDensity, setGridDensity] = useState<StorefrontGridDensity>(
    DEFAULT_STOREFRONT_THEME.gridDensity!
  )
  const [surface, setSurface] = useState<StorefrontSurface>(DEFAULT_STOREFRONT_THEME.surface!)
  const [headerBrandAlign, setHeaderBrandAlign] = useState<StorefrontHeaderBrandAlign>(
    DEFAULT_STOREFRONT_THEME.headerBrandAlign!
  )
  const [presetId, setPresetId] = useState<string | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<BrandStudioSnapshot | null>(null)

  const hydrate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/store/me", { credentials: "include", cache: "no-store" })
      const json = (await res.json()) as {
        store?: StoreRow
        publicStoreUrl?: string
        storeUrls?: {
          primaryUrl: string
          subdomainUrl: string
          platformPathUrl: string
          customDomainUrl: string | null
        }
        storeHostSuffix?: string | null
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? t("loadFailed"))
      if (json.publicStoreUrl) setPublicStoreUrl(json.publicStoreUrl)
      if (json.storeUrls) setStoreUrls(json.storeUrls)
      setStoreHostSuffix(json.storeHostSuffix ?? null)
      const st = json.store
      if (st) {
        const snap = snapshotFromStore(st)
        setName(snap.name)
        setBannerUrl(snap.bannerUrl)
        setDescription(snap.description)
        setLogoUrl(snap.logoUrl)
        setLogoPreview(st.logoUrl)
        setLogoFile(null)
        setAccent(snap.accent)
        setPrimaryHex(snap.primaryHex)
        setNameBadge(snap.nameBadge)
        setLayout(snap.layout)
        setHeroStyle(snap.heroStyle)
        setGridDensity(snap.gridDensity)
        setSurface(snap.surface)
        setHeaderBrandAlign(snap.headerBrandAlign)
        setPresetId(snap.presetId)
        setSavedSnapshot(snap)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  function applyPreset(theme: StorefrontTheme, id: string) {
    setPresetId(id)
    setPrimaryHex(theme.primary ?? DEFAULT_STOREFRONT_THEME.primary!)
    setAccent(theme.accent ?? DEFAULT_STOREFRONT_THEME.accent!)
    setNameBadge(theme.nameBadge ?? DEFAULT_STORE_NAME_BADGE)
    setLayout(theme.layout ?? DEFAULT_STOREFRONT_THEME.layout!)
    setHeroStyle(theme.heroStyle ?? DEFAULT_STOREFRONT_THEME.heroStyle!)
    setGridDensity(theme.gridDensity ?? DEFAULT_STOREFRONT_THEME.gridDensity!)
    setSurface(theme.surface ?? DEFAULT_STOREFRONT_THEME.surface!)
    setHeaderBrandAlign(theme.headerBrandAlign ?? DEFAULT_STOREFRONT_THEME.headerBrandAlign!)
  }

  const previewDraft = useMemo(
    () => ({
      name,
      description,
      bannerUrl,
      logoUrl: logoFile ? logoPreview : logoUrl.trim() || logoPreview,
      primary: primaryHex,
      accent,
      nameBadge,
      layout,
      heroStyle,
      gridDensity,
      surface,
      headerBrandAlign,
    }),
    [
      name,
      description,
      bannerUrl,
      logoUrl,
      logoPreview,
      logoFile,
      primaryHex,
      accent,
      nameBadge,
      layout,
      heroStyle,
      gridDensity,
      surface,
      headerBrandAlign,
    ]
  )

  const currentSnapshot = useMemo(
    () =>
      snapshotFromDraft({
        name,
        description,
        bannerUrl,
        logoUrl,
        primaryHex,
        accent,
        nameBadge,
        layout,
        heroStyle,
        gridDensity,
        surface,
        headerBrandAlign,
        presetId,
      }),
    [
      name,
      description,
      bannerUrl,
      logoUrl,
      primaryHex,
      accent,
      nameBadge,
      layout,
      heroStyle,
      gridDensity,
      surface,
      headerBrandAlign,
      presetId,
    ]
  )

  const isDirty = Boolean(logoFile) || (savedSnapshot ? !snapshotsEqual(currentSnapshot, savedSnapshot) : false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.set("name", name.trim().slice(0, 40))
      fd.set("description", description)
      fd.set("bannerUrl", bannerUrl.trim())
      fd.set("themePrimary", primaryHex)
      fd.set("themeAccent", accent)
      fd.set("themeNameBadge", nameBadge)
      fd.set("themeLayout", layout)
      fd.set("themeHeroStyle", heroStyle)
      fd.set("themeGridDensity", gridDensity)
      fd.set("themeSurface", surface)
      fd.set("themeHeaderBrandAlign", headerBrandAlign)
      if (presetId) fd.set("themePresetId", presetId)
      if (logoFile) {
        fd.set("logo", logoFile)
      } else {
        fd.set("logoUrl", logoUrl.trim())
      }

      const res = await fetch("/api/store/update", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? t("saveFailed"))
      setMessage(t("saved"))
      setSavedSnapshot(currentSnapshot)
      setLogoFile(null)
      await hydrate()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const eyebrow = role === "AFFILIATE" ? t("affiliateEyebrow") : t("supplierEyebrow")
  const title = role === "AFFILIATE" ? t("affiliateTitle") : t("supplierTitle")
  const desc = role === "AFFILIATE" ? t("affiliateDescription") : t("supplierDescription")

  const saveButton = (
    <Button
      type="submit"
      form={BRAND_STUDIO_FORM_ID}
      variant="bentoSolid"
      size="bento"
      disabled={saving || !isDirty}
      className="min-w-[9.5rem] shrink-0"
    >
      <Save className="size-5" aria-hidden />
      {saving ? t("saving") : t("saveBrand")}
    </Button>
  )

  if (loading && !name) {
    return (
      <BentoShell>
        <BentoContainer maxWidth="6xl">
          <BentoCard className="py-16 text-center text-sm text-gray-600 dark:text-zinc-400">{t("loading")}</BentoCard>
        </BentoContainer>
      </BentoShell>
    )
  }

  return (
    <BentoShell>
      <BentoContainer maxWidth="6xl" className="space-y-8 pb-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <BentoPageHeading
            eyebrow={eyebrow}
            title={title}
            description={desc}
            className="max-w-2xl"
          />
          <div className="flex flex-wrap items-center gap-2">
            {saveButton}
            {publicStoreUrl ? (
              <a
                href={publicStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-medium text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100"
                )}
              >
                <Sparkles className="size-4" aria-hidden />
                {t("liveUrl")}
              </a>
            ) : null}
            <Link
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <ExternalLink className="size-4" aria-hidden />
              {t("previewAffisell")}
            </Link>
          </div>
        </div>

        {isDirty ? (
          <BentoCard className="border-amber-200/80 bg-amber-50/70 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-semibold">{t("unsavedChanges")}</span>
                <span className="mt-0.5 block text-amber-900/80 dark:text-amber-100/80">{t("saveHint")}</span>
              </p>
              {saveButton}
            </div>
          </BentoCard>
        ) : null}

        {error ? (
          <BentoCard className="border-rose-200 bg-rose-50/80 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </BentoCard>
        ) : null}
        {message ? (
          <BentoCard className="border-emerald-200 bg-emerald-50/80 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            {message}
          </BentoCard>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)]">
          <BentoCard>
            <form id={BRAND_STUDIO_FORM_ID} onSubmit={onSubmit} className="space-y-8">
              <StorefrontThemePresetPicker value={presetId} onApply={applyPreset} />

              <div className="space-y-2">
                <label htmlFor="bs-name" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t("storeName")}
                </label>
                <Input id="bs-name" bento value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <StorefrontLogoField
                logoUrl={logoUrl}
                logoPreview={logoPreview}
                onLogoUrlChange={setLogoUrl}
                onLogoFile={setLogoFile}
              />

              <div className="space-y-2">
                <label htmlFor="bs-banner" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t("heroBanner")}
                </label>
                <Input
                  id="bs-banner"
                  bento
                  type="url"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="bs-desc" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t("tagline")}
                </label>
                <textarea
                  id="bs-desc"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="flex min-h-[100px] w-full rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-white"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="bs-primary" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t("primary")}
                  </label>
                  <input
                    id="bs-primary"
                    type="color"
                    value={primaryHex}
                    onChange={(e) => setPrimaryHex(e.target.value)}
                    className="h-11 w-full cursor-pointer rounded-xl border border-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="bs-accent" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t("accent")}
                  </label>
                  <input
                    id="bs-accent"
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-11 w-full cursor-pointer rounded-xl border border-gray-200"
                  />
                </div>
              </div>

              <div
                className="h-20 rounded-2xl shadow-inner"
                style={{
                  background: `linear-gradient(120deg, ${primaryHex}, ${accent})`,
                }}
                aria-hidden
              />

              <StorefrontLayoutControls
                layout={layout}
                heroStyle={heroStyle}
                gridDensity={gridDensity}
                surface={surface}
                headerBrandAlign={headerBrandAlign}
                onLayout={setLayout}
                onHeroStyle={setHeroStyle}
                onGridDensity={setGridDensity}
                onSurface={setSurface}
                onHeaderBrandAlign={setHeaderBrandAlign}
              />

              <StoreNameBadgePicker
                value={nameBadge}
                onChange={setNameBadge}
                previewName={name.trim() || "Ecom Store"}
                accent={accent}
                primary={primaryHex}
              />

              <div className="sticky bottom-0 z-10 -mx-2 border-t border-gray-200/80 bg-white/90 px-2 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 sm:-mx-4 sm:px-4">
                {saveButton}
              </div>
            </form>
          </BentoCard>

          <div className="space-y-4">
            <div className="xl:sticky xl:top-4">
              <BentoCard className="overflow-hidden bg-gradient-to-b from-violet-50/80 to-white dark:from-violet-950/20 dark:to-zinc-950">
                <StorefrontLivePreview draft={previewDraft} />
              </BentoCard>
            </div>
            <StoreLiveUrlCard urls={storeUrls} storeHostSuffix={storeHostSuffix} loading={loading} />
            <StoreCustomDomainCard variant="studio" />
            <BentoCard className="text-sm text-gray-600 dark:text-zinc-400">
              <p className="flex items-center gap-2 font-medium text-gray-900 dark:text-zinc-100">
                <Palette className="size-4 text-violet-600" aria-hidden />
                {t("logoLogisticsTitle")}
              </p>
              <p className="mt-2">
                {t.rich("logoLogisticsBody", {
                  profileLink: () => (
                    <Link
                      href={profileHref}
                      className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                    >
                      {profileLabel}
                    </Link>
                  ),
                })}
              </p>
            </BentoCard>
          </div>
        </div>
      </BentoContainer>

      {isDirty ? (
        <div
          className="fixed inset-x-0 bottom-0 z-[120] border-t border-violet-500/25 bg-zinc-950/95 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/85 lg:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <p className="min-w-0 flex-1 text-xs font-medium text-violet-100/90">{t("unsavedChanges")}</p>
            {saveButton}
          </div>
        </div>
      ) : null}
    </BentoShell>
  )
}
