"use client"

import { Check, Loader2, RotateCw, ShoppingBag, Sparkles } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { AIPersonalizeModal } from "@/components/boutique/AIPersonalizeModal"
import { ResellerBoutiqueProductCard } from "@/components/boutique/ResellerBoutiqueProductCard"
import { BoutiqueStoreTitle } from "@/components/boutique/boutique-store-title"
import { ResellerBoutiquePageShell } from "@/components/boutique/reseller-boutique-page-shell"
import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"
import type { BrandStudioSnapshot } from "@/lib/boutique/haute-gamme-themes-shared"
import type { HauteGammeTypography } from "@/lib/boutique/haute-gamme-themes-shared"
import {
  DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
  type BoutiqueTitleTypography,
} from "@/lib/boutique/boutique-title-typography-shared"
import type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"
import {
  DEFAULT_STOREFRONT_THEME_ID,
  getStorefrontThemeById,
  nextStorefrontThemeId,
  parseStorefrontThemeId,
  themeRefFromVibe,
  type StorefrontTheme,
  writeStoredStorefrontTheme,
} from "@/lib/boutique/storefront-themes"
import { postBrandAiJson } from "@/lib/storefront-ai-fetch-shared"
import { cn } from "@/lib/utils"

type ResellerStorefrontGridProps = {
  storeSlug: string
  storeLabel: string
  tagline?: string | null
  brandTheme: ResellerBoutiqueThemeProps
  initialVisualTheme?: StorefrontTheme
  persistedVisualTheme?: StorefrontTheme
  titleTypography?: BoutiqueTitleTypography
  persistedTitleTypography?: BoutiqueTitleTypography
  productCardTrustLine: string
  products: ResellerStorefrontListProduct[]
  count: number
  header?: ReactNode
  viewerIsOwner?: boolean
  brandStudio?: BrandStudioSnapshot | null
}

function typographyEqual(a: BoutiqueTitleTypography, b: BoutiqueTitleTypography): boolean {
  return (
    a.fontId === b.fontId &&
    a.ornamentId === b.ornamentId &&
    a.layoutId === b.layoutId &&
    (a.displayOverride ?? null) === (b.displayOverride ?? null)
  )
}

function readInitialTheme(storeSlug: string, fallback: StorefrontTheme): StorefrontTheme {
  if (typeof window === "undefined") return fallback
  try {
    const stored = parseStorefrontThemeId(
      window.localStorage.getItem(`affisell:store-theme:${storeSlug}`)
    )
    return stored ?? fallback
  } catch {
    return fallback
  }
}

export function ResellerStorefrontGrid({
  storeSlug,
  storeLabel,
  tagline,
  brandTheme: _brandTheme,
  initialVisualTheme = DEFAULT_STOREFRONT_THEME_ID,
  persistedVisualTheme = DEFAULT_STOREFRONT_THEME_ID,
  titleTypography: initialTitleTypography = DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
  persistedTitleTypography = DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
  productCardTrustLine,
  products,
  count,
  header,
  viewerIsOwner: viewerIsOwnerHint = false,
  brandStudio = null,
}: ResellerStorefrontGridProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [theme, setTheme] = useState<StorefrontTheme>(initialVisualTheme)
  const [displayTagline, setDisplayTagline] = useState<string | null>(tagline?.trim() ?? null)
  const [titleTypography, setTitleTypography] = useState<BoutiqueTitleTypography>(initialTitleTypography)
  const [hydrated, setHydrated] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isStoreOwner, setIsStoreOwner] = useState(viewerIsOwnerHint)
  const [persistedTheme, setPersistedTheme] = useState<StorefrontTheme>(persistedVisualTheme)
  const [persistedTypography, setPersistedTypography] =
    useState<BoutiqueTitleTypography>(persistedTitleTypography)
  const [persistedTagline, setPersistedTagline] = useState<string | null>(tagline?.trim() ?? null)

  const themeDef = useMemo(() => getStorefrontThemeById(theme), [theme])
  const activeBrandStudio = brandStudio
  const badgeLabel = activeBrandStudio
    ? `${activeBrandStudio.designId.toUpperCase()} · ${activeBrandStudio.designIndex}/1024`
    : `${themeDef.family} · ${themeDef.index + 1}/1024`
  const heroTypography: HauteGammeTypography | undefined = activeBrandStudio?.typography
  const resolvedTitleTypography = useMemo(() => {
    if (!activeBrandStudio) return titleTypography
    return {
      ...titleTypography,
      layoutId: "custom-only" as const,
      displayOverride: activeBrandStudio.heroTitle,
    }
  }, [activeBrandStudio, titleTypography])

  const isDirty =
    theme !== persistedTheme ||
    !typographyEqual(titleTypography, persistedTypography) ||
    (displayTagline ?? null) !== persistedTagline

  useEffect(() => {
    if (tagline?.trim()) setDisplayTagline(tagline.trim())
  }, [tagline])

  useEffect(() => {
    setTitleTypography(initialTitleTypography)
    setPersistedTypography(persistedTitleTypography)
  }, [initialTitleTypography, persistedTitleTypography])

  useEffect(() => {
    setPersistedTheme(persistedVisualTheme)
  }, [persistedVisualTheme])

  useEffect(() => {
    if (viewerIsOwnerHint) {
      setIsStoreOwner(true)
      return
    }
    let cancelled = false
    void fetch("/api/store/me", { credentials: "include", cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as { store?: { slug?: string } }) : null))
      .then((data) => {
        if (!cancelled) setIsStoreOwner(data?.store?.slug === storeSlug)
      })
      .catch(() => {
        if (!cancelled) setIsStoreOwner(false)
      })
    return () => {
      cancelled = true
    }
  }, [storeSlug, viewerIsOwnerHint])

  useEffect(() => {
    if (!isStoreOwner) {
      setTheme(persistedVisualTheme)
      setHydrated(true)
      return
    }
    const fromUrl = parseStorefrontThemeId(searchParams.get("theme"))
    const fromStorage = readInitialTheme(storeSlug, initialVisualTheme)
    setTheme(fromUrl ?? fromStorage)
    setHydrated(true)
  }, [initialVisualTheme, isStoreOwner, persistedVisualTheme, searchParams, storeSlug])

  useEffect(() => {
    if (!hydrated || !isStoreOwner) return
    writeStoredStorefrontTheme(storeSlug, theme)
    const url = new URL(window.location.href)
    url.searchParams.set("theme", theme)
    window.history.replaceState(null, "", url.toString())
  }, [hydrated, isStoreOwner, storeSlug, theme])

  useEffect(() => {
    if (isStoreOwner) return
    setTheme(persistedVisualTheme)
  }, [isStoreOwner, persistedVisualTheme])

  const applyTheme = useCallback((next: StorefrontTheme) => {
    setTheme(next)
  }, [])

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    const nextTheme = nextStorefrontThemeId(theme)
    const nextDef = getStorefrontThemeById(nextTheme)
    setTheme(nextTheme)
    toast.success(`Theme: ${nextDef.label} ✨`)
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 600)
    })
    setRegenerating(false)
  }, [theme])

  const handleSaveDesign = useCallback(async () => {
    if (!isStoreOwner || !isDirty) return
    setSaving(true)
    try {
      const result = await postBrandAiJson<{
        persisted?: boolean
        themeId: StorefrontTheme
        label: string
      }>(
        "/api/store/save-boutique-design",
        {
          storeSlug,
          themeId: theme,
          tagline: displayTagline,
          fontId: titleTypography.fontId,
          ornamentId: titleTypography.ornamentId,
          layoutId: titleTypography.layoutId,
          displayOverride: titleTypography.displayOverride,
        },
        "Save failed"
      )

      if (!result.ok || !result.data?.themeId) {
        throw new Error(result.error ?? "Save failed")
      }

      setPersistedTheme(result.data.themeId)
      setPersistedTypography(titleTypography)
      setPersistedTagline(displayTagline ?? null)
      toast.success(`${result.data.label} — design saved for all visitors ✨`)
      console.log("[boutique]", {
        event: "design_saved",
        storeSlug,
        themeId: result.data.themeId,
        result: "ok",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed"
      toast.error(msg)
      console.log("[boutique]", { event: "design_saved", storeSlug, result: "error", error: msg })
    } finally {
      setSaving(false)
    }
  }, [
    displayTagline,
    isDirty,
    isStoreOwner,
    storeSlug,
    theme,
    titleTypography,
  ])

  const handleGenerateFromModal = async ({
    vibe,
    themeId,
    titleTypography: nextTitleTypography,
  }: {
    vibe: string
    themeId: StorefrontTheme
    titleTypography: BoutiqueTitleTypography
  }) => {
    setRegenerating(true)
    const locale =
      typeof document !== "undefined" && document.documentElement.lang?.startsWith("fr")
        ? "fr"
        : "en"

    try {
      const [themeResult, titleResult] = await Promise.all([
        postBrandAiJson<{
          themeId: StorefrontTheme
          label: string
          tagline?: string
          rationale?: string
          persisted?: boolean
        }>(
          "/api/store/personalize-boutique-theme",
          {
            vibe: vibe.trim(),
            locale,
            themeId: vibe.trim() ? undefined : themeId,
            persist: true,
          },
          "Personalization failed"
        ),
        postBrandAiJson<{ typography: typeof nextTitleTypography }>(
          "/api/store/update-boutique-title",
          {
            fontId: nextTitleTypography.fontId,
            ornamentId: nextTitleTypography.ornamentId,
            layoutId: nextTitleTypography.layoutId,
            displayOverride: nextTitleTypography.displayOverride,
          },
          "Title save failed"
        ),
      ])

      const resolvedThemeId =
        themeResult.ok && themeResult.data?.themeId
          ? themeResult.data.themeId
          : vibe.trim()
            ? themeRefFromVibe(vibe)
            : themeId

      applyTheme(resolvedThemeId)
      const def = getStorefrontThemeById(resolvedThemeId)

      if (titleResult.ok && titleResult.data?.typography) {
        setTitleTypography(titleResult.data.typography)
      } else {
        setTitleTypography(nextTitleTypography)
      }

      if (themeResult.ok && themeResult.data) {
        if (themeResult.data.tagline?.trim()) setDisplayTagline(themeResult.data.tagline.trim())
        setPersistedTheme(resolvedThemeId)
        setPersistedTagline(themeResult.data.tagline?.trim() ?? displayTagline ?? null)
        setPersistedTypography(
          titleResult.ok && titleResult.data?.typography
            ? titleResult.data.typography
            : nextTitleTypography
        )
        toast.success(
          themeResult.data.persisted
            ? `${def.label} — live for all visitors ✨`
            : `${def.label} ✨`
        )
        if (themeResult.data.rationale?.trim()) {
          toast.message(themeResult.data.rationale.trim(), { duration: 5000 })
        }
      } else {
        toast.success(`${def.label} ✨`)
      }
      setModalOpen(false)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <ResellerBoutiquePageShell themeId={theme} brandStudio={activeBrandStudio} header={header}>
      <div className="relative mb-12 w-full">
        <div className="mb-6 flex flex-col gap-2 sm:absolute sm:right-0 sm:top-0 sm:z-20 sm:mb-0 sm:flex-row sm:flex-wrap sm:justify-end">
          {isStoreOwner ? (
            <>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium shadow-[0_0_24px_var(--boutique-accent-soft)] transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: "var(--boutique-ai-bg)",
              borderColor: "var(--boutique-ai-border)",
              color: "var(--boutique-ai-text)",
            }}
          >
            <Sparkles className="size-4 shrink-0" aria-hidden />
            Personalize my store with AI ✨
          </button>
          <button
            type="button"
            title="Regenerate layout with AI"
            onClick={() => void handleRegenerate()}
            disabled={regenerating || saving}
            className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300 disabled:opacity-60"
            style={{
              background: "var(--boutique-regen-bg)",
              borderColor: "var(--boutique-regen-border)",
              color: "var(--boutique-regen-text)",
            }}
          >
            <RotateCw
              className={cn("size-4 shrink-0", regenerating && "animate-spin")}
              aria-hidden
            />
            ↻ Regenerate
          </button>
            <button
              type="button"
              title="Save design for all visitors"
              disabled={!isDirty || saving || regenerating}
              onClick={() => void handleSaveDesign()}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50",
                isDirty && "hover:scale-[1.02] hover:shadow-lg"
              )}
              style={
                isDirty
                  ? {
                      backgroundImage:
                        "linear-gradient(90deg, var(--boutique-button-from), var(--boutique-button-to))",
                      borderColor: "transparent",
                      color: "#fff",
                      boxShadow: "var(--boutique-button-shadow)",
                    }
                  : {
                      background: "var(--boutique-badge-bg)",
                      borderColor: "var(--boutique-badge-border)",
                      color: "var(--boutique-badge-text)",
                    }
              }
            >
              {saving ? (
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4 shrink-0" aria-hidden />
              )}
              {saving ? "Saving…" : isDirty ? "Save design ✨" : "Design saved"}
            </button>
            </>
          ) : null}
        </div>

        <header className="relative w-full pt-2 pr-0 sm:pr-[28rem]">
          <BoutiqueStoreTitle
            storeLabel={storeLabel}
            typography={resolvedTitleTypography}
            heroTypography={heroTypography}
          />

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-sm"
              style={{
                background: "var(--boutique-badge-bg)",
                borderColor: "var(--boutique-badge-border)",
                color: "var(--boutique-badge-text)",
              }}
            >
              <ShoppingBag className="size-4 shrink-0 opacity-80" aria-hidden />
              {count} produit{count > 1 ? "s" : ""}
            </span>
            <span
              className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              style={{
                borderColor: "var(--boutique-badge-border)",
                color: "var(--boutique-accent)",
              }}
            >
              {badgeLabel}
            </span>
          </div>

          {displayTagline ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--boutique-header-muted)" }}>
              {displayTagline}
            </p>
          ) : null}
        </header>
      </div>

      <div
        className={cn(
          "grid w-full grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
          regenerating && "animate-pulse duration-700"
        )}
      >
        {products.map((product) => (
          <ResellerBoutiqueProductCard
            key={product.id}
            product={product}
            productCardTrustLine={productCardTrustLine}
            onViewProduct={(listingId) =>
              router.push(
                `/boutique/${encodeURIComponent(storeSlug)}?productId=${encodeURIComponent(listingId)}`
              )
            }
          />
        ))}
      </div>

      <footer
        className="mt-12 w-full border-t pt-6 text-center text-xs"
        style={{
          borderColor: "var(--boutique-footer-border)",
          color: "var(--boutique-footer-text)",
        }}
      >
        Boutique {storeSlug} · Propulsé par Affisell ·{" "}
        {activeBrandStudio ? activeBrandStudio.designId.toUpperCase() : themeDef.label}
      </footer>

      <AIPersonalizeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        storeSlug={storeSlug}
        storeLabel={storeLabel}
        selectedTheme={theme}
        titleTypography={titleTypography}
        onThemeSelect={applyTheme}
        onTitleTypographyChange={setTitleTypography}
        onGenerate={handleGenerateFromModal}
        onRegenerateDescription={handleRegenerate}
        generating={regenerating}
      />
    </ResellerBoutiquePageShell>
  )
}
