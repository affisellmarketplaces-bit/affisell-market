"use client"

import Link from "next/link"
import { ExternalLink, Palette, Save, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import type { FormEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { StoreCustomDomainCard } from "@/components/storefront/store-custom-domain-card"
import { StorefrontBrandLaunchPanel } from "@/components/storefront/storefront-brand-launch-panel"
import { StorefrontBrandPreviewPanel } from "@/components/storefront/storefront-brand-preview-panel"
import { StorefrontEmbedWidgetPanel } from "@/components/storefront/storefront-embed-widget-panel"
import { StorefrontHeroVideoField } from "@/components/storefront/storefront-hero-video-field"
import { StorefrontHeaderColorPicker } from "@/components/storefront/storefront-header-color-picker"
import { StorefrontLayoutControls } from "@/components/storefront/storefront-layout-controls"
import { StorefrontLogoField } from "@/components/storefront/storefront-logo-field"
import { StorefrontSectionsEditor } from "@/components/storefront/storefront-sections-editor"
import { StorefrontStaticPagesEditor } from "@/components/storefront/storefront-static-pages-editor"
import { StorefrontThemePresetPicker } from "@/components/storefront/storefront-theme-preset-picker"
import { StorefrontShareGrowPanel } from "@/components/storefront/storefront-share-grow-panel"
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
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  homepageSectionsEqual,
  serializeHomepageSections,
  type HomepageSection,
} from "@/lib/storefront-sections-shared"
import {
  DEFAULT_STATIC_PAGES,
  serializeStaticPages,
  staticPagesEqual,
  type StorefrontStaticPages,
} from "@/lib/storefront-static-pages-shared"
import {
  DEFAULT_EMBED_WIDGET,
  embedWidgetsEqual,
  serializeEmbedWidget,
  type StorefrontEmbedWidget,
} from "@/lib/storefront-embed-shared"
import type { BrandLaunchConfig } from "@/lib/storefront-brand-launch"
import { capturePosthogClient } from "@/lib/analytics/posthog"
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
  trustRailText: string
  nameBadge: StoreNameBadgeStyle
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  gridDensity: StorefrontGridDensity
  surface: StorefrontSurface
  headerBrandAlign: StorefrontHeaderBrandAlign
  presetId: string | null
  homepageSections: HomepageSection[]
  staticPages: StorefrontStaticPages
  heroVideoUrl: string
  embedWidget: StorefrontEmbedWidget
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
    trustRailText: theme.trustRailText ?? DEFAULT_STOREFRONT_THEME.trustRailText!,
    nameBadge: theme.nameBadge ?? DEFAULT_STORE_NAME_BADGE,
    layout: theme.layout ?? DEFAULT_STOREFRONT_THEME.layout!,
    heroStyle: theme.heroStyle ?? DEFAULT_STOREFRONT_THEME.heroStyle!,
    gridDensity: theme.gridDensity ?? DEFAULT_STOREFRONT_THEME.gridDensity!,
    surface: theme.surface ?? DEFAULT_STOREFRONT_THEME.surface!,
    headerBrandAlign: theme.headerBrandAlign ?? DEFAULT_STOREFRONT_THEME.headerBrandAlign!,
    presetId: theme.presetId ?? null,
    homepageSections: theme.homepageSections ?? DEFAULT_HOMEPAGE_SECTIONS,
    staticPages: theme.staticPages ?? DEFAULT_STATIC_PAGES,
    heroVideoUrl: theme.heroVideoUrl ?? "",
    embedWidget: theme.embedWidget ?? DEFAULT_EMBED_WIDGET,
  }
}

function snapshotFromDraft(input: {
  name: string
  description: string
  bannerUrl: string
  logoUrl: string
  primaryHex: string
  accent: string
  trustRailText: string
  nameBadge: StoreNameBadgeStyle
  layout: StorefrontLayoutMode
  heroStyle: StorefrontHeroStyle
  gridDensity: StorefrontGridDensity
  surface: StorefrontSurface
  headerBrandAlign: StorefrontHeaderBrandAlign
  presetId: string | null
  homepageSections: HomepageSection[]
  staticPages: StorefrontStaticPages
  heroVideoUrl: string
  embedWidget: StorefrontEmbedWidget
}): BrandStudioSnapshot {
  return {
    name: input.name.trim().slice(0, 40),
    description: input.description.trim(),
    bannerUrl: input.bannerUrl.trim(),
    logoUrl: input.logoUrl.trim(),
    primaryHex: input.primaryHex,
    accent: input.accent,
    trustRailText: input.trustRailText,
    nameBadge: input.nameBadge,
    layout: input.layout,
    heroStyle: input.heroStyle,
    gridDensity: input.gridDensity,
    surface: input.surface,
    headerBrandAlign: input.headerBrandAlign,
    presetId: input.presetId,
    homepageSections: input.homepageSections,
    staticPages: input.staticPages,
    heroVideoUrl: input.heroVideoUrl.trim(),
    embedWidget: input.embedWidget,
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
    a.trustRailText === b.trustRailText &&
    a.nameBadge === b.nameBadge &&
    a.layout === b.layout &&
    a.heroStyle === b.heroStyle &&
    a.gridDensity === b.gridDensity &&
    a.surface === b.surface &&
    a.headerBrandAlign === b.headerBrandAlign &&
    a.presetId === b.presetId &&
    homepageSectionsEqual(a.homepageSections, b.homepageSections) &&
    staticPagesEqual(a.staticPages, b.staticPages) &&
    a.heroVideoUrl === b.heroVideoUrl &&
    embedWidgetsEqual(a.embedWidget, b.embedWidget)
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
  const [trustRailText, setTrustRailText] = useState(DEFAULT_STOREFRONT_THEME.trustRailText!)
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
  const [homepageSections, setHomepageSections] = useState<HomepageSection[]>(DEFAULT_HOMEPAGE_SECTIONS)
  const [staticPages, setStaticPages] = useState<StorefrontStaticPages>(DEFAULT_STATIC_PAGES)
  const [heroVideoUrl, setHeroVideoUrl] = useState("")
  const [embedWidget, setEmbedWidget] = useState<StorefrontEmbedWidget>(DEFAULT_EMBED_WIDGET)
  const [storeSlug, setStoreSlug] = useState("")
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const [savedSnapshot, setSavedSnapshot] = useState<BrandStudioSnapshot | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const applyLaunchConfig = useCallback((config: BrandLaunchConfig) => {
    setPresetId(config.presetId)
    setPrimaryHex(config.primary)
    setAccent(config.accent)
    setTrustRailText(config.trustRailText)
    setNameBadge(config.nameBadge)
    setLayout(config.layout)
    setHeroStyle(config.heroStyle)
    setGridDensity(config.gridDensity)
    setSurface(config.surface)
    setHeaderBrandAlign(config.headerBrandAlign)
    setDescription(config.description)
    setHomepageSections(config.homepageSections)
    setStaticPages(config.staticPages)
  }, [])

  const hydrate = useCallback(async () => {
    if (!mountedRef.current) return
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
      if (!mountedRef.current) return
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
        setTrustRailText(snap.trustRailText)
        setNameBadge(snap.nameBadge)
        setLayout(snap.layout)
        setHeroStyle(snap.heroStyle)
        setGridDensity(snap.gridDensity)
        setSurface(snap.surface)
        setHeaderBrandAlign(snap.headerBrandAlign)
        setPresetId(snap.presetId)
        setHomepageSections(snap.homepageSections)
        setStaticPages(snap.staticPages)
        setHeroVideoUrl(snap.heroVideoUrl)
        setEmbedWidget(snap.embedWidget)
        setStoreSlug(st.slug)
        setSavedSnapshot(snap)
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : t("loadFailed"))
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const persistSnapshot = useCallback(
    async (snapshot: BrandStudioSnapshot, successMessage: string): Promise<boolean> => {
      if (!mountedRef.current) return false
      setSaving(true)
      setError(null)
      setMessage(null)
      try {
        const fd = new FormData()
        fd.set("name", snapshot.name)
        fd.set("description", snapshot.description)
        fd.set("bannerUrl", snapshot.bannerUrl)
        fd.set("themePrimary", snapshot.primaryHex)
        fd.set("themeAccent", snapshot.accent)
        fd.set("themeTrustRailText", snapshot.trustRailText)
        fd.set("themeNameBadge", snapshot.nameBadge)
        fd.set("themeLayout", snapshot.layout)
        fd.set("themeHeroStyle", snapshot.heroStyle)
        fd.set("themeGridDensity", snapshot.gridDensity)
        fd.set("themeSurface", snapshot.surface)
        fd.set("themeHeaderBrandAlign", snapshot.headerBrandAlign)
        if (snapshot.presetId) fd.set("themePresetId", snapshot.presetId)
        fd.set("themeHomepageSections", serializeHomepageSections(snapshot.homepageSections))
        fd.set("themeStaticPages", serializeStaticPages(snapshot.staticPages))
        fd.set("themeHeroVideoUrl", snapshot.heroVideoUrl)
        fd.set("themeEmbedWidget", serializeEmbedWidget(snapshot.embedWidget))
        if (logoFile) {
          fd.set("logo", logoFile)
        } else {
          fd.set("logoUrl", snapshot.logoUrl)
        }

        const res = await fetch("/api/store/update", {
          method: "POST",
          body: fd,
          credentials: "include",
        })
        const json = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(json.error ?? t("saveFailed"))
        if (!mountedRef.current) return false
        setMessage(successMessage)
        setSavedSnapshot(snapshot)
        setLogoFile(null)
        setPreviewRefreshKey((k) => k + 1)
        capturePosthogClient("brand_studio_saved", {
          role,
          presetId: snapshot.presetId ?? "none",
          heroStyle: snapshot.heroStyle,
          layout: snapshot.layout,
        })
        console.log("[brand-studio]", { role, presetId: snapshot.presetId, result: "saved" })
        return true
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : t("saveFailed"))
        }
        return false
      } finally {
        if (mountedRef.current) setSaving(false)
      }
    },
    [logoFile, role, t]
  )

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await persistSnapshot(currentSnapshot, t("saved"))
  }

  const handleBrandLaunch = useCallback(
    async (config: BrandLaunchConfig) => {
      applyLaunchConfig(config)
      const launchSnapshot = snapshotFromDraft({
        name,
        description: config.description,
        bannerUrl,
        logoUrl,
        primaryHex: config.primary,
        accent: config.accent,
        trustRailText: config.trustRailText,
        nameBadge: config.nameBadge,
        layout: config.layout,
        heroStyle: config.heroStyle,
        gridDensity: config.gridDensity,
        surface: config.surface,
        headerBrandAlign: config.headerBrandAlign,
        presetId: config.presetId,
        homepageSections: config.homepageSections,
        staticPages: config.staticPages,
        heroVideoUrl,
        embedWidget,
      })
      const saved = await persistSnapshot(launchSnapshot, t("launch.saved"))
      if (!saved) return

      try {
        const res = await fetch("/api/store/generate-hero-video", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
        const json = (await res.json()) as { videoUrl?: string; error?: string }
        if (res.ok && json.videoUrl) {
          setHeroVideoUrl(json.videoUrl)
          setHeroStyle("video")
          const withVideo = snapshotFromDraft({
            name,
            description: config.description,
            bannerUrl,
            logoUrl,
            primaryHex: config.primary,
            accent: config.accent,
            trustRailText: config.trustRailText,
            nameBadge: config.nameBadge,
            layout: config.layout,
            heroStyle: "video",
            gridDensity: config.gridDensity,
            surface: config.surface,
            headerBrandAlign: config.headerBrandAlign,
            presetId: config.presetId,
            homepageSections: config.homepageSections,
            staticPages: config.staticPages,
            heroVideoUrl: json.videoUrl,
            embedWidget,
          })
          await persistSnapshot(withVideo, t("launch.veoSaved"))
          capturePosthogClient("brand_launch_veo_hero", {
            niche: config.niche,
            role,
            presetId: config.presetId,
          })
          console.log("[brand-launch]", { niche: config.niche, result: "veo_hero" })
        }
      } catch (err) {
        console.log("[brand-launch]", {
          niche: config.niche,
          result: "veo_skipped",
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [applyLaunchConfig, bannerUrl, embedWidget, heroVideoUrl, logoUrl, name, persistSnapshot, role, t]
  )

  function applyPreset(theme: StorefrontTheme, id: string) {
    capturePosthogClient("brand_preset_selected", { presetId: id, role })
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
      trustRailText,
      nameBadge,
      layout,
      heroStyle,
      gridDensity,
      surface,
      headerBrandAlign,
      homepageSections,
      heroVideoUrl,
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
      trustRailText,
      nameBadge,
      layout,
      heroStyle,
      gridDensity,
      surface,
      headerBrandAlign,
      homepageSections,
      heroVideoUrl,
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
        trustRailText,
        nameBadge,
        layout,
        heroStyle,
        gridDensity,
        surface,
        headerBrandAlign,
        presetId,
        homepageSections,
        staticPages,
        heroVideoUrl,
        embedWidget,
      }),
    [
      name,
      description,
      bannerUrl,
      logoUrl,
      primaryHex,
      accent,
      trustRailText,
      nameBadge,
      layout,
      heroStyle,
      gridDensity,
      surface,
      headerBrandAlign,
      presetId,
      homepageSections,
      staticPages,
      heroVideoUrl,
      embedWidget,
    ]
  )

  const isDirty = Boolean(logoFile) || (savedSnapshot ? !snapshotsEqual(currentSnapshot, savedSnapshot) : false)

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

        <StorefrontBrandLaunchPanel
          storeName={name}
          role={role}
          busy={saving}
          onLaunch={handleBrandLaunch}
        />

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

              <StorefrontHeaderColorPicker value={primaryHex} accent={accent} onChange={setPrimaryHex} />

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

              <div className="space-y-2">
                <label htmlFor="bs-trust-rail" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t("trustRailText")}
                </label>
                <p className="text-xs text-gray-500 dark:text-zinc-400">{t("trustRailTextHint")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="bs-trust-rail"
                    type="color"
                    value={trustRailText}
                    onChange={(e) => setTrustRailText(e.target.value)}
                    className="h-11 min-w-[4.5rem] flex-1 cursor-pointer rounded-xl border border-gray-200"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setTrustRailText(DEFAULT_STOREFRONT_THEME.trustRailText!)}
                  >
                    {t("trustRailTextReset")}
                  </Button>
                </div>
              </div>

              <div
                className="h-16 rounded-2xl shadow-inner"
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

              <StorefrontHeroVideoField
                heroStyle={heroStyle}
                heroVideoUrl={heroVideoUrl}
                storeName={name.trim() || t("launch.defaultStoreName")}
                onHeroStyle={setHeroStyle}
                onHeroVideoUrl={setHeroVideoUrl}
              />

              {role === "AFFILIATE" && storeSlug ? (
                <StorefrontEmbedWidgetPanel
                  slug={storeSlug}
                  storeName={name.trim() || t("launch.defaultStoreName")}
                  widget={embedWidget}
                  onChange={setEmbedWidget}
                />
              ) : null}

              <StorefrontSectionsEditor sections={homepageSections} onChange={setHomepageSections} />

              <StorefrontStaticPagesEditor pages={staticPages} onChange={setStaticPages} />

              <StoreNameBadgePicker
                value={nameBadge}
                onChange={setNameBadge}
                previewName={name.trim() || "Ecom Store"}
                accent={accent}
                primary={primaryHex}
              />

              <div className="sticky bottom-0 z-10 -mx-2 hidden border-t border-gray-200/80 bg-white/90 px-2 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 sm:-mx-4 sm:px-4 lg:block">
                {saveButton}
              </div>
            </form>
          </BentoCard>

          <div className="space-y-4">
            <div className="xl:sticky xl:top-4">
              <BentoCard className="overflow-hidden bg-gradient-to-b from-violet-50/80 to-white dark:from-violet-950/20 dark:to-zinc-950">
                <StorefrontBrandPreviewPanel
                  previewHref={previewHref}
                  isDirty={isDirty}
                  draft={previewDraft}
                  refreshKey={previewRefreshKey}
                />
              </BentoCard>
            </div>
            <StoreLiveUrlCard urls={storeUrls} storeHostSuffix={storeHostSuffix} loading={loading} />
            {storeSlug && storeUrls?.primaryUrl ? (
              <StorefrontShareGrowPanel
                slug={storeSlug}
                storeName={name}
                shopUrl={storeUrls.primaryUrl}
                embedEnabled={embedWidget.enabled}
                onEnableEmbed={() => setEmbedWidget((prev) => ({ ...prev, enabled: true }))}
              />
            ) : null}
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
