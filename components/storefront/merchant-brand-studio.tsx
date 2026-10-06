"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ExternalLink, Layers, Palette, Save, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import type { FormEvent } from "react"
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { StorefrontAiCopyButton } from "@/components/storefront/storefront-ai-copy-button"
import { BrandStudioFieldHeader } from "@/components/storefront/brand-studio-field-header"
import { StorefrontAiThemeStudioPanel } from "@/components/storefront/storefront-ai-theme-studio-panel"
import { BoutiqueAiPersonalizePanel } from "@/components/storefront/boutique-ai-personalize-panel"
import { BoutiqueTitleStudioPanel } from "@/components/storefront/boutique-title-studio-panel"
import { StorefrontBrandLaunchPanel } from "@/components/storefront/storefront-brand-launch-panel"
import { StorefrontBrandPreviewPanel } from "@/components/storefront/storefront-brand-preview-panel"
import { StorefrontBrandPulsePanel } from "@/components/storefront/storefront-brand-pulse-panel"
import { StorefrontEmbedWidgetPanel } from "@/components/storefront/storefront-embed-widget-panel"
import { StorefrontHeroVideoField } from "@/components/storefront/storefront-hero-video-field"
import { StorefrontHeaderColorPicker } from "@/components/storefront/storefront-header-color-picker"
import { StorefrontThemeContrastPanel } from "@/components/storefront/storefront-theme-contrast-panel"
import { StorefrontLayoutControls } from "@/components/storefront/storefront-layout-controls"
import { StorefrontLogoField } from "@/components/storefront/storefront-logo-field"
import { StorefrontSectionsEditor } from "@/components/storefront/storefront-sections-editor"
import { StorefrontStaticPagesEditor } from "@/components/storefront/storefront-static-pages-editor"
import { StorefrontThemePresetPicker } from "@/components/storefront/storefront-theme-preset-picker"
import { StoreLiveUrlCard } from "@/components/storefront/store-live-url-card"
import { BrandPaletteFromLogo } from "@/components/storefront/brand-palette-from-logo"
import { BrandStudioDraftBanner } from "@/components/storefront/brand-studio-draft-banner"
import { BrandStudioHistoryBar } from "@/components/storefront/brand-studio-history-bar"
import { LazyPanel } from "@/components/storefront/lazy-panel"
import { StorefrontModeCard } from "@/components/storefront/storefront-mode-card"
import type { StorePublicUrls } from "@/lib/store-public-url-shared"
import {
  buildDraft,
  clearDraft,
  evaluateDraft,
  readDraft,
  writeDraft,
} from "@/lib/storefront/brand-studio-draft"
import {
  canRedo,
  canUndo,
  createHistory,
  recordChange,
  redo,
  undo,
  type History,
} from "@/lib/storefront/brand-studio-history"
import {
  snapshotFromDraft,
  snapshotFromStore,
  snapshotsEqual,
  type BrandStudioSnapshot,
  type BrandStudioStoreRow,
} from "@/lib/storefront/brand-studio-snapshot"
import { StoreNameBadgePicker } from "@/components/storefront/store-name-badge-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DEFAULT_STORE_NAME_BADGE,
  type StoreNameBadgeStyle,
} from "@/lib/store-name-badge-styles"
import {
  DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
  parseBoutiqueTitleTypography,
  type BoutiqueTitleTypography,
} from "@/lib/boutique/boutique-title-typography-shared"
import { formatResellerStoreLabel } from "@/lib/boutique/reseller-storefront-shared"
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
  serializeHomepageSections,
  updateHomepageSectionContent,
  type HomepageSection,
} from "@/lib/storefront-sections-shared"
import {
  buildDefaultStaticPages,
  DEFAULT_STATIC_PAGES,
  hasMeaningfulStaticPages,
  serializeStaticPages,
  type StorefrontStaticPages,
} from "@/lib/storefront-static-pages-shared"
import {
  buildDefaultEmbedWidget,
  DEFAULT_EMBED_WIDGET,
  hasMeaningfulEmbedWidget,
  serializeEmbedWidget,
  type StorefrontEmbedWidget,
} from "@/lib/storefront-embed-shared"
import type { BrandLaunchConfig } from "@/lib/storefront-brand-launch"
import type { StorefrontPresetAb } from "@/lib/storefront-preset-ab-shared"
import { computeBrandPulse } from "@/lib/storefront-brand-pulse-shared"
import { brandAiThemeToStorefrontTheme } from "@/lib/storefront-brand-ai-theme-shared"
import type { BrandAiThemePayload, BrandAiThemePresetId } from "@/lib/storefront-brand-ai-theme-shared"
import type { BrandFieldGenerateResponse } from "@/lib/storefront-brand-field-generate-shared"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import { readAmplifyCopiedFlag } from "@/lib/storefront-share-channel-recommendation"
import { cn } from "@/lib/utils"

type MerchantRole = "AFFILIATE" | "SUPPLIER"

/** Below-the-fold panels: separate chunks, downloaded and mounted only when scrolled near (see <LazyPanel>). */
const StorefrontPresetOptimizerPanel = dynamic(
  () => import("@/components/storefront/storefront-preset-optimizer-panel").then((m) => m.StorefrontPresetOptimizerPanel),
  { ssr: false }
)
const StorefrontPresetAbPanel = dynamic(
  () => import("@/components/storefront/storefront-preset-ab-panel").then((m) => m.StorefrontPresetAbPanel),
  { ssr: false }
)
const StorefrontBrandAnalyticsPanel = dynamic(
  () => import("@/components/storefront/storefront-brand-analytics-panel").then((m) => m.StorefrontBrandAnalyticsPanel),
  { ssr: false }
)
const StorefrontShareGrowPanel = dynamic(
  () => import("@/components/storefront/storefront-share-grow-panel").then((m) => m.StorefrontShareGrowPanel),
  { ssr: false }
)
const StoreCustomDomainCard = dynamic(
  () => import("@/components/storefront/store-custom-domain-card").then((m) => m.StoreCustomDomainCard),
  { ssr: false }
)

const BRAND_STUDIO_FORM_ID = "brand-studio-form"

type Props = {
  role: MerchantRole
  previewHref: string
  /** Public reseller boutique grid at /boutique/{slug} */
  boutiquePreviewHref?: string
  profileHref: string
  profileLabel: string
  studioPath?: string
  createListingHref?: string
}

export function MerchantBrandStudio({
  role,
  previewHref,
  boutiquePreviewHref,
  profileHref,
  profileLabel,
  studioPath,
  createListingHref,
}: Props) {
  const t = useTranslations("storefront.brandStudio")
  const searchParams = useSearchParams()
  const focusSharePanel = searchParams.get("share") === "1"
  const postShareLoop =
    focusSharePanel || searchParams.get("welcome") === "1"
  const focusTarget = searchParams.get("focus")
  const amplifyShare = searchParams.get("amplify") === "1"
  const autofillTrust = searchParams.get("autofillTrust") === "1"
  const autofillEmbed = searchParams.get("autofillEmbed") === "1"
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [publicStoreUrl, setPublicStoreUrl] = useState<string | null>(null)
  const [storeUrls, setStoreUrls] = useState<StorePublicUrls | null>(null)
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
  const [heroVideoShowStoreName, setHeroVideoShowStoreName] = useState(true)
  const [embedWidget, setEmbedWidget] = useState<StorefrontEmbedWidget>(DEFAULT_EMBED_WIDGET)
  const [storeSlug, setStoreSlug] = useState("")
  const [boutiqueTitleTypography, setBoutiqueTitleTypography] =
    useState<BoutiqueTitleTypography>(DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY)
  const [brandPulseMetrics, setBrandPulseMetrics] = useState({
    liveCatalogCount: 0,
    customDomainVerified: false,
    brandPulseLastScore: null as number | null,
    totalListingClicks: 0,
    totalListingConversions: 0,
  })
  const [presetAb, setPresetAb] = useState<StorefrontPresetAb | null>(null)
  const [amplifyKitUsed, setAmplifyKitUsed] = useState(false)
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const [savedSnapshot, setSavedSnapshot] = useState<BrandStudioSnapshot | null>(null)
  const [history, setHistory] = useState<History<BrandStudioSnapshot> | null>(null)
  const [draftOffer, setDraftOffer] = useState<{ snapshot: BrandStudioSnapshot; savedAt: number } | null>(null)
  const [draftChecked, setDraftChecked] = useState(false)
  const latestSnapshotRef = useRef<BrandStudioSnapshot | null>(null)
  const mountedRef = useRef(false)
  const trustAutofillConsumedRef = useRef(false)
  const embedAutofillConsumedRef = useRef(false)
  const logoPanelRef = useRef<HTMLDivElement | null>(null)
  const pagesPanelRef = useRef<HTMLDivElement | null>(null)
  const embedPanelRef = useRef<HTMLDivElement | null>(null)
  const sharePanelRef = useRef<HTMLDivElement | null>(null)
  const domainPanelRef = useRef<HTMLDivElement | null>(null)
  const [domainEager, setDomainEager] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!focusSharePanel) return
    const timer = window.setTimeout(() => {
      sharePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focusSharePanel])

  useEffect(() => {
    if (!focusTarget) return
    const node =
      focusTarget === "logo"
        ? logoPanelRef.current
        : focusTarget === "pages"
          ? pagesPanelRef.current
          : focusTarget === "embed"
            ? embedPanelRef.current
            : null
    if (!node) return
    const timer = window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focusTarget])

  /** Puts every editable field back to a snapshot — used by hydrate, undo/redo and draft restore. */
  const applySnapshot = useCallback((snap: BrandStudioSnapshot) => {
    setName(snap.name)
    setBannerUrl(snap.bannerUrl)
    setDescription(snap.description)
    setLogoUrl(snap.logoUrl)
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
    setHeroVideoShowStoreName(snap.heroVideoShowStoreName)
    setEmbedWidget(snap.embedWidget)
  }, [])

  /**
   * Commits whatever is being edited as its own history step. Called before every discrete action (preset, Generate, theme,
   * palette, launch) so those become one undo step each instead of merging into the typing that preceded them.
   */
  const flushHistory = useCallback(() => {
    const current = latestSnapshotRef.current
    if (!current) return
    setHistory((h) => (h ? recordChange(h, current, snapshotsEqual) : h))
  }, [])

  /** "Connect my domain": mount the (lazy) domain panel now and bring it into view. */
  const manageDomain = useCallback(() => {
    setDomainEager(true)
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const bringIntoView = (behavior: ScrollBehavior) =>
      domainPanelRef.current?.scrollIntoView({ behavior, block: "center" })
    window.setTimeout(() => bringIntoView(reduceMotion ? "auto" : "smooth"), 150)
    // Other lazy panels mount as the page scrolls past them and push the target down: re-check until it settles in view.
    for (const delay of [900, 1500, 2300]) {
      window.setTimeout(() => {
        const rect = domainPanelRef.current?.getBoundingClientRect()
        if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) bringIntoView("auto")
      }, delay)
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
        store?: BrandStudioStoreRow
        publicStoreUrl?: string
        storeUrls?: StorePublicUrls
        storeHostSuffix?: string | null
        brandPulseMetrics?: {
          liveCatalogCount: number
          customDomainVerified: boolean
          brandPulseLastScore?: number | null
          totalListingClicks?: number
          totalListingConversions?: number
        }
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? t("loadFailed"))
      if (!mountedRef.current) return
      if (json.publicStoreUrl) setPublicStoreUrl(json.publicStoreUrl)
      if (json.storeUrls) setStoreUrls(json.storeUrls)
      setStoreHostSuffix(json.storeHostSuffix ?? null)
      if (json.brandPulseMetrics) {
        setBrandPulseMetrics({
          liveCatalogCount: json.brandPulseMetrics.liveCatalogCount,
          customDomainVerified: json.brandPulseMetrics.customDomainVerified,
          brandPulseLastScore: json.brandPulseMetrics.brandPulseLastScore ?? null,
          totalListingClicks: json.brandPulseMetrics.totalListingClicks ?? 0,
          totalListingConversions: json.brandPulseMetrics.totalListingConversions ?? 0,
        })
      }
      const st = json.store
      if (st) {
        const snap = snapshotFromStore(st)
        applySnapshot(snap)
        setLogoPreview(st.logoUrl)
        setLogoFile(null)
        setStoreSlug(st.slug)
        setBoutiqueTitleTypography(parseBoutiqueTitleTypography(parseStorefrontTheme(st.storefrontTheme)))
        setPresetAb(parseStorefrontTheme(st.storefrontTheme).brandOps?.presetAb ?? null)
        setSavedSnapshot(snap)
        // A fresh load (or a reload after saving an A/B test) starts a new history from what is saved.
        setHistory(createHistory(snapshotFromDraft(snap)))
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : t("loadFailed"))
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [applySnapshot, t])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!storeSlug) return
    setAmplifyKitUsed(readAmplifyCopiedFlag(storeSlug))
  }, [storeSlug])

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
        fd.set("themeHeroVideoShowStoreName", snapshot.heroVideoShowStoreName ? "1" : "0")
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

  useEffect(() => {
    if (trustAutofillConsumedRef.current) return
    if (focusTarget !== "pages" || !autofillTrust || !name.trim() || !savedSnapshot) return
    if (logoFile) return
    if (hasMeaningfulStaticPages(staticPages)) {
      trustAutofillConsumedRef.current = true
      return
    }

    trustAutofillConsumedRef.current = true
    const nextStaticPages = buildDefaultStaticPages({
      storeName: name.trim(),
      description: description.trim(),
    })
    const nextSnapshot = snapshotFromDraft({
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
      staticPages: nextStaticPages,
      heroVideoUrl,
      heroVideoShowStoreName,
      embedWidget,
    })

    setStaticPages(nextStaticPages)
    setMessage(t("trustPagesAutofilled"))
    capturePosthogClient("brand_trust_pages_autofilled", { role, storeSlug: storeSlug || "unknown" })
    console.log("[brand-studio]", {
      role,
      storeSlug,
      result: "trust_pages_autofilled",
    })
    void persistSnapshot(nextSnapshot, t("trustPagesPublished"))
  }, [
    accent,
    autofillTrust,
    bannerUrl,
    description,
    embedWidget,
    focusTarget,
    gridDensity,
    headerBrandAlign,
    heroStyle,
    heroVideoUrl,
    homepageSections,
    layout,
    logoFile,
    logoUrl,
    name,
    nameBadge,
    persistSnapshot,
    presetId,
    primaryHex,
    role,
    savedSnapshot,
    staticPages,
    storeSlug,
    surface,
    t,
    trustRailText,
  ])

  useEffect(() => {
    if (embedAutofillConsumedRef.current) return
    if (focusTarget !== "embed" || !autofillEmbed || !name.trim() || !savedSnapshot) return
    if (logoFile) return
    if (hasMeaningfulEmbedWidget(embedWidget)) {
      embedAutofillConsumedRef.current = true
      return
    }

    embedAutofillConsumedRef.current = true
    const nextEmbedWidget = buildDefaultEmbedWidget({ storeName: name.trim() })
    const nextSnapshot = snapshotFromDraft({
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
      heroVideoShowStoreName,
      embedWidget: nextEmbedWidget,
    })

    setEmbedWidget(nextEmbedWidget)
    setMessage(t("embedWidgetPublished"))
    capturePosthogClient("brand_embed_widget_autofilled", { role, storeSlug: storeSlug || "unknown" })
    console.log("[brand-studio]", {
      role,
      storeSlug,
      result: "embed_widget_autofilled",
    })
    void persistSnapshot(nextSnapshot, t("embedWidgetPublished"))
  }, [
    accent,
    autofillEmbed,
    bannerUrl,
    description,
    embedWidget,
    focusTarget,
    gridDensity,
    headerBrandAlign,
    heroStyle,
    heroVideoUrl,
    homepageSections,
    layout,
    logoFile,
    logoUrl,
    name,
    nameBadge,
    persistSnapshot,
    presetId,
    primaryHex,
    role,
    savedSnapshot,
    staticPages,
    storeSlug,
    surface,
    t,
    trustRailText,
  ])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await persistSnapshot(currentSnapshot, t("saved"))
  }

  const handleBrandLaunch = useCallback(
    async (config: BrandLaunchConfig) => {
      flushHistory()
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
        heroVideoShowStoreName,
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
          setHeroVideoShowStoreName(true)
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
            heroVideoShowStoreName: true,
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
    [applyLaunchConfig, bannerUrl, embedWidget, flushHistory, heroVideoUrl, logoUrl, name, persistSnapshot, role, t]
  )

  function applyPreset(theme: StorefrontTheme, id: string) {
    flushHistory()
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

  const applyBrandFieldResult = useCallback(
    (result: BrandFieldGenerateResponse) => {
      flushHistory()
      if (result.name) setName(result.name)
      if (result.logoUrl) {
        setLogoUrl(result.logoUrl)
        setLogoFile(null)
      }
      if (result.bannerUrl) {
        setBannerUrl(result.bannerUrl)
        setHeroStyle("banner")
      }
      if (result.description) setDescription(result.description)
      if (result.primary) setPrimaryHex(result.primary)
      if (result.accent) setAccent(result.accent)
      if (result.trustRailText) setTrustRailText(result.trustRailText)
      if (result.nameBadge) setNameBadge(result.nameBadge)
      if (result.layout) setLayout(result.layout)
      if (result.heroStyle) setHeroStyle(result.heroStyle)
      if (result.gridDensity) setGridDensity(result.gridDensity)
      if (result.surface) setSurface(result.surface)
      if (result.headerBrandAlign) setHeaderBrandAlign(result.headerBrandAlign)
      if (result.homepageSections) setHomepageSections(result.homepageSections)
      if (result.staticPages) setStaticPages(result.staticPages)
      if (result.embedWidget) setEmbedWidget(result.embedWidget)

      if (result.presetId && result.primary && result.accent) {
        const payload: BrandAiThemePayload = {
          presetId: result.presetId as BrandAiThemePresetId,
          primary: result.primary,
          accent: result.accent,
          surface: result.surface ?? "dark",
          layout: result.layout ?? "immersive",
          heroStyle: result.heroStyle ?? "gradient",
          gridDensity: result.gridDensity ?? "spacious",
          description: result.description ?? description,
          boutiqueTagline: result.description ?? description,
          storyBody: result.description ?? description,
          rationale: "AI field generate",
          source: result.source === "ai" ? "ai" : "rules",
        }
        applyPreset(brandAiThemeToStorefrontTheme(payload), result.presetId)
      }
    },
    [description, flushHistory]
  )

  const brandGenerateProps = useMemo(
    () => ({
      role,
      disabled: saving || loading,
      onApply: applyBrandFieldResult,
    }),
    [applyBrandFieldResult, loading, role, saving]
  )

  const handleAiThemeApplyAndSave = useCallback(
    async (payload: BrandAiThemePayload): Promise<boolean> => {
      const theme = brandAiThemeToStorefrontTheme(payload)
      const nextSections = updateHomepageSectionContent(homepageSections, "story", {
        body: payload.storyBody,
      })

      applyPreset(theme, payload.presetId)
      setDescription(payload.description)
      setHomepageSections(nextSections)

      const nextSnapshot = snapshotFromDraft({
        name,
        description: payload.description,
        bannerUrl,
        logoUrl,
        primaryHex: payload.primary,
        accent: payload.accent,
        trustRailText,
        nameBadge: theme.nameBadge ?? nameBadge,
        layout: payload.layout,
        heroStyle: payload.heroStyle,
        gridDensity: payload.gridDensity,
        surface: payload.surface,
        headerBrandAlign,
        presetId: payload.presetId,
        homepageSections: nextSections,
        staticPages,
        heroVideoUrl,
        heroVideoShowStoreName,
        embedWidget,
      })

      return persistSnapshot(nextSnapshot, t("aiTheme.saved"))
    },
    [
      homepageSections,
      name,
      bannerUrl,
      logoUrl,
      trustRailText,
      nameBadge,
      headerBrandAlign,
      staticPages,
      heroVideoUrl,
      heroVideoShowStoreName,
      embedWidget,
      persistSnapshot,
      t,
    ]
  )

  const brandPulse = useMemo(
    () =>
      computeBrandPulse({
        name,
        description,
        logoUrl,
        bannerUrl,
        presetId,
        layout,
        heroStyle,
        heroVideoUrl,
        surface,
        embedEnabled: embedWidget.enabled,
        homepageSections,
        staticPages,
        liveCatalogCount: brandPulseMetrics.liveCatalogCount,
        customDomainVerified: brandPulseMetrics.customDomainVerified,
        role,
      }),
    [
      name,
      description,
      logoUrl,
      bannerUrl,
      presetId,
      layout,
      heroStyle,
      heroVideoUrl,
      surface,
      embedWidget.enabled,
      homepageSections,
      staticPages,
      brandPulseMetrics,
      role,
    ]
  )

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
      heroVideoShowStoreName,
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
      heroVideoShowStoreName,
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
        heroVideoShowStoreName,
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
      heroVideoShowStoreName,
      embedWidget,
    ]
  )

  const isDirty = Boolean(logoFile) || (savedSnapshot ? !snapshotsEqual(currentSnapshot, savedSnapshot) : false)

  // The live preview re-renders a whole mock storefront; let typing and clicking stay first-class and the preview follow.
  const deferredPreviewDraft = useDeferredValue(previewDraft)

  // ---- history: record settled edits, undo / redo ---------------------------------------------------------------
  useEffect(() => {
    latestSnapshotRef.current = currentSnapshot
  }, [currentSnapshot])

  useEffect(() => {
    // Typing is coalesced: a step is recorded once the design has been still for a moment (and always before a
    // discrete action, via flushHistory). Applying an undo/redo result is a no-op here — it equals the present.
    const timer = window.setTimeout(() => {
      setHistory((h) => (h ? recordChange(h, currentSnapshot, snapshotsEqual) : h))
    }, 600)
    return () => window.clearTimeout(timer)
  }, [currentSnapshot])

  const handleUndo = useCallback(() => {
    if (!history) return
    // Make sure edits made in the last fraction of a second are a step too, so Undo never skips them.
    const settled = recordChange(history, currentSnapshot, snapshotsEqual)
    const next = undo(settled)
    setHistory(next)
    if (next !== settled) applySnapshot(next.present)
  }, [applySnapshot, currentSnapshot, history])

  const handleRedo = useCallback(() => {
    if (!history) return
    const next = redo(history)
    setHistory(next)
    if (next !== history) applySnapshot(next.present)
  }, [applySnapshot, history])

  const undoAvailable = history
    ? canUndo(history) || !snapshotsEqual(history.present, currentSnapshot)
    : false
  const redoAvailable = history ? canRedo(history) && snapshotsEqual(history.present, currentSnapshot) : false

  // ---- local draft: survive an accidental close, offer it back next time ---------------------------------------
  useEffect(() => {
    if (draftChecked || !savedSnapshot || !storeSlug) return
    setDraftChecked(true)
    const stored = readDraft(typeof window === "undefined" ? null : window.localStorage, storeSlug)
    if (!stored) return
    const verdict = evaluateDraft(stored, savedSnapshot, Date.now())
    if (verdict.action === "restore") {
      setDraftOffer({ snapshot: verdict.snapshot, savedAt: verdict.savedAt })
    } else {
      clearDraft(window.localStorage, storeSlug)
    }
  }, [draftChecked, savedSnapshot, storeSlug])

  useEffect(() => {
    // Never touch storage while a recovered draft is waiting for the merchant's answer.
    if (!draftChecked || draftOffer || !savedSnapshot || !storeSlug) return
    const storage = window.localStorage
    if (snapshotsEqual(currentSnapshot, savedSnapshot)) {
      clearDraft(storage, storeSlug)
      return
    }
    const timer = window.setTimeout(() => {
      writeDraft(storage, buildDraft({ slug: storeSlug, snapshot: currentSnapshot, base: savedSnapshot, now: Date.now() }))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [currentSnapshot, draftChecked, draftOffer, savedSnapshot, storeSlug])

  const restoreDraft = useCallback(() => {
    if (!draftOffer) return
    flushHistory()
    applySnapshot(draftOffer.snapshot)
    setDraftOffer(null)
    setMessage(t("draft.restored"))
  }, [applySnapshot, draftOffer, flushHistory, t])

  const discardDraft = useCallback(() => {
    if (storeSlug) clearDraft(window.localStorage, storeSlug)
    setDraftOffer(null)
  }, [storeSlug])

  // Closing the tab with unsaved edits asks first (in-app navigation is covered by the draft above).
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  // Editor shortcuts. Inside a text field the browser's own undo keeps working on the characters being typed.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const key = e.key.toLowerCase()
      const target = e.target as HTMLElement | null
      const inTextField =
        !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      if (key === "s") {
        e.preventDefault()
        if (isDirty && !saving) void persistSnapshot(currentSnapshot, t("saved"))
        return
      }
      if (inTextField) return
      if (key === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [currentSnapshot, handleRedo, handleUndo, isDirty, persistSnapshot, saving, t])

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
      title={t("shortcuts.save")}
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
            <BrandStudioHistoryBar
              canUndo={undoAvailable}
              canRedo={redoAvailable}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
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
            {boutiquePreviewHref && role === "AFFILIATE" ? (
              <Link
                href={boutiquePreviewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-medium text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100"
              >
                <Palette className="size-4" aria-hidden />
                {t("boutiquePreview")}
              </Link>
            ) : null}
            <Link
              href="/demo/storefront-formats"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-indigo-200/90 bg-indigo-50/80 px-4 text-sm font-medium text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100"
            >
              <Layers className="size-4" aria-hidden />
              {t("formatsCatalog")}
            </Link>
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

        <StorefrontModeCard variant="studio" onManageDomain={manageDomain} />

        {draftOffer ? (
          <BrandStudioDraftBanner savedAt={draftOffer.savedAt} onRestore={restoreDraft} onDiscard={discardDraft} />
        ) : null}

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

        <StorefrontAiThemeStudioPanel
          role={role}
          disabled={saving || loading}
          boutiquePreviewHref={boutiquePreviewHref}
          onApplyAndSave={handleAiThemeApplyAndSave}
        />

        <BoutiqueAiPersonalizePanel
          role={role}
          storeSlug={storeSlug}
          disabled={saving || loading}
          boutiquePreviewHref={boutiquePreviewHref}
        />

        <BoutiqueTitleStudioPanel
          role={role}
          storeLabel={storeSlug ? formatResellerStoreLabel(storeSlug) : name || "Ma boutique"}
          initialTypography={boutiqueTitleTypography}
          disabled={saving || loading}
          boutiquePreviewHref={boutiquePreviewHref}
          onSaved={setBoutiqueTitleTypography}
        />

        <StorefrontBrandLaunchPanel
          storeName={name}
          role={role}
          busy={saving}
          onLaunch={handleBrandLaunch}
        />

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)]">
          <BentoCard>
            <form id={BRAND_STUDIO_FORM_ID} onSubmit={onSubmit} className="space-y-8">
              <StorefrontThemePresetPicker
                value={presetId}
                onApply={applyPreset}
                generate={brandGenerateProps}
                slug={storeSlug}
              />

              <div className="space-y-2">
                <BrandStudioFieldHeader
                  htmlFor="bs-name"
                  label={t("storeName")}
                  generate={{ field: "name", ...brandGenerateProps }}
                />
                <Input id="bs-name" bento value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div
                ref={logoPanelRef}
                className={cn(
                  "space-y-3",
                  focusTarget === "logo" &&
                    "rounded-3xl ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-white dark:ring-emerald-500/60 dark:ring-offset-zinc-950"
                )}
              >
                <StorefrontLogoField
                  logoUrl={logoUrl}
                  logoPreview={logoPreview}
                  onLogoUrlChange={setLogoUrl}
                  onLogoFile={setLogoFile}
                  generate={brandGenerateProps}
                />
                <BrandPaletteFromLogo
                  logoSrc={logoFile ? logoPreview : logoUrl.trim() || logoPreview}
                  primary={primaryHex}
                  accent={accent}
                  onApply={(nextPrimary, nextAccent) => {
                    flushHistory()
                    setPrimaryHex(nextPrimary)
                    setAccent(nextAccent)
                    setMessage(t("palette.applied"))
                  }}
                />
              </div>

              <div className="space-y-2">
                <BrandStudioFieldHeader
                  htmlFor="bs-banner"
                  label={t("heroBanner")}
                  generate={{ field: "banner", ...brandGenerateProps }}
                />
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
                <BrandStudioFieldHeader
                  htmlFor="bs-desc"
                  label={t("tagline")}
                  generate={{ field: "copy", ...brandGenerateProps }}
                />
                <textarea
                  id="bs-desc"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="flex min-h-[100px] w-full rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-white"
                />
                <StorefrontAiCopyButton
                  storeName={name}
                  role={role}
                  disabled={saving}
                  homepageSections={homepageSections}
                  onApply={({ description: nextDescription, homepageSections: nextSections }) => {
                    setDescription(nextDescription)
                    if (nextSections.length > 0) setHomepageSections(nextSections)
                  }}
                />
              </div>

              <StorefrontHeaderColorPicker
                value={primaryHex}
                accent={accent}
                onChange={setPrimaryHex}
                generate={brandGenerateProps}
              />

              <div className="space-y-2">
                <BrandStudioFieldHeader
                  htmlFor="bs-accent"
                  label={t("accent")}
                  generate={{ field: "colors", ...brandGenerateProps }}
                />
                <input
                  id="bs-accent"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-11 w-full cursor-pointer rounded-xl border border-gray-200"
                />
              </div>

              <div className="space-y-2">
                <BrandStudioFieldHeader
                  htmlFor="bs-trust-rail"
                  label={t("trustRailText")}
                  hint={t("trustRailTextHint")}
                  generate={{ field: "colors", ...brandGenerateProps }}
                />
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

              <StorefrontThemeContrastPanel
                primary={primaryHex}
                accent={accent}
                trustRailText={trustRailText}
                surface={surface}
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
                generate={brandGenerateProps}
              />

              <StorefrontHeroVideoField
                heroStyle={heroStyle}
                heroVideoUrl={heroVideoUrl}
                heroVideoShowStoreName={heroVideoShowStoreName}
                storeName={name.trim() || t("launch.defaultStoreName")}
                nameBadge={nameBadge}
                accent={accent}
                primary={primaryHex}
                headerBrandAlign={headerBrandAlign}
                onHeroStyle={setHeroStyle}
                onHeroVideoUrl={setHeroVideoUrl}
                onHeroVideoShowStoreName={setHeroVideoShowStoreName}
              />

              {role === "AFFILIATE" && storeSlug ? (
                <div
                  ref={embedPanelRef}
                  className={cn(
                    focusTarget === "embed" &&
                      "rounded-3xl ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-white dark:ring-emerald-500/60 dark:ring-offset-zinc-950"
                  )}
                >
                  <StorefrontEmbedWidgetPanel
                    slug={storeSlug}
                    storeName={name.trim() || t("launch.defaultStoreName")}
                    widget={embedWidget}
                    onChange={setEmbedWidget}
                    generate={brandGenerateProps}
                  />
                </div>
              ) : null}

              <StorefrontSectionsEditor
                sections={homepageSections}
                onChange={setHomepageSections}
                generate={{
                  ...brandGenerateProps,
                  onSectionApply: applyBrandFieldResult,
                }}
              />

              <div
                ref={pagesPanelRef}
                className={cn(
                  focusTarget === "pages" &&
                    "rounded-3xl ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-white dark:ring-emerald-500/60 dark:ring-offset-zinc-950"
                )}
              >
                <StorefrontStaticPagesEditor
                  pages={staticPages}
                  onChange={setStaticPages}
                  role={role}
                  disabled={saving}
                />
              </div>

              <StoreNameBadgePicker
                value={nameBadge}
                onChange={setNameBadge}
                previewName={name.trim() || "Ecom Store"}
                accent={accent}
                primary={primaryHex}
                generate={brandGenerateProps}
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
                  draft={deferredPreviewDraft}
                  refreshKey={previewRefreshKey}
                />
              </BentoCard>
            </div>
            <StorefrontBrandPulsePanel
              pulse={brandPulse}
              lastScore={brandPulseMetrics.brandPulseLastScore}
            />
            <LazyPanel minHeight={220}>
              <StorefrontPresetOptimizerPanel
                pulse={brandPulse}
                presetId={presetId}
                lastScore={brandPulseMetrics.brandPulseLastScore}
                presetAb={presetAb}
                role={role}
                onApplyPreset={applyPreset}
                onAbStarted={() => void hydrate()}
              />
            </LazyPanel>
            <LazyPanel minHeight={200}>
              <StorefrontPresetAbPanel
                role={role}
                storeSlug={storeSlug}
                controlPresetId={presetId}
                presetAb={presetAb}
                onUpdated={() => void hydrate()}
              />
            </LazyPanel>
            <LazyPanel minHeight={220}>
              <StorefrontBrandAnalyticsPanel
                role={role}
                presetId={presetId}
                liveCatalogCount={brandPulseMetrics.liveCatalogCount}
                totalListingClicks={brandPulseMetrics.totalListingClicks}
                totalListingConversions={brandPulseMetrics.totalListingConversions}
                embedEnabled={embedWidget.enabled}
                amplifyKitUsed={amplifyKitUsed}
                studioPath={studioPath}
                createListingHref={createListingHref}
              />
            </LazyPanel>
            <StoreLiveUrlCard urls={storeUrls} storeHostSuffix={storeHostSuffix} loading={loading} />
            {storeSlug && storeUrls?.primaryUrl ? (
              <div
                ref={sharePanelRef}
                className={cn(
                  focusSharePanel &&
                    "rounded-3xl ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-white dark:ring-emerald-500/60 dark:ring-offset-zinc-950"
                )}
              >
                <LazyPanel minHeight={320} eager={focusSharePanel}>
                  <StorefrontShareGrowPanel
                    slug={storeSlug}
                    storeName={name}
                    shopUrl={storeUrls.primaryUrl}
                    embedEnabled={embedWidget.enabled}
                    onEnableEmbed={() => setEmbedWidget((prev) => ({ ...prev, enabled: true }))}
                    amplifyMode={amplifyShare && role === "AFFILIATE"}
                    onAmplifyCopied={() => setAmplifyKitUsed(true)}
                    postShareLoop={postShareLoop && role === "AFFILIATE"}
                    initialTotalClicks={brandPulseMetrics.totalListingClicks}
                    initialTotalConversions={brandPulseMetrics.totalListingConversions}
                  />
                </LazyPanel>
              </div>
            ) : null}
            <div ref={domainPanelRef} id="store-domain-card">
              <LazyPanel minHeight={180} eager={domainEager}>
                <StoreCustomDomainCard variant="studio" />
              </LazyPanel>
            </div>
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
            <BrandStudioHistoryBar
              canUndo={undoAvailable}
              canRedo={redoAvailable}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
            {saveButton}
          </div>
        </div>
      ) : null}
    </BentoShell>
  )
}
