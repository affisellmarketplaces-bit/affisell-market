"use client"

import Image from "next/image"
import { Eye, RotateCw, ShoppingBag, Sparkles } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { AIPersonalizeModal } from "@/components/boutique/AIPersonalizeModal"
import { ResellerBoutiquePageShell } from "@/components/boutique/reseller-boutique-page-shell"
import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"
import type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"
import {
  DEFAULT_STOREFRONT_THEME_ID,
  getStorefrontThemeById,
  nextStorefrontThemeId,
  parseStorefrontThemeId,
  type StorefrontTheme,
  writeStoredStorefrontTheme,
} from "@/lib/boutique/storefront-themes"
import { cn } from "@/lib/utils"

type ResellerStorefrontGridProps = {
  storeSlug: string
  storeLabel: string
  tagline?: string | null
  brandTheme: ResellerBoutiqueThemeProps
  initialVisualTheme?: StorefrontTheme
  products: ResellerStorefrontListProduct[]
  count: number
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
  products,
  count,
}: ResellerStorefrontGridProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [theme, setTheme] = useState<StorefrontTheme>(initialVisualTheme)
  const [hydrated, setHydrated] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const themeDef = useMemo(() => getStorefrontThemeById(theme), [theme])

  useEffect(() => {
    const fromUrl = parseStorefrontThemeId(searchParams.get("theme"))
    const fromStorage = readInitialTheme(storeSlug, initialVisualTheme)
    setTheme(fromUrl ?? fromStorage)
    setHydrated(true)
  }, [initialVisualTheme, searchParams, storeSlug])

  useEffect(() => {
    if (!hydrated) return
    writeStoredStorefrontTheme(storeSlug, theme)
    const url = new URL(window.location.href)
    url.searchParams.set("theme", theme)
    window.history.replaceState(null, "", url.toString())
  }, [hydrated, storeSlug, theme])

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

  const handleGenerateFromModal = async ({
    vibe,
    themeId,
  }: {
    vibe: string
    themeId: StorefrontTheme
  }) => {
    applyTheme(themeId)
    setModalOpen(false)
    toast.success(`Theme: ${getStorefrontThemeById(themeId).label} ✨`)
    if (vibe.trim()) {
      void fetch("/api/store/generate-brand-copy", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: vibe.trim(), locale: "fr" }),
      }).catch(() => {
        /* optional AI — theme already applied */
      })
    }
  }

  return (
    <ResellerBoutiquePageShell themeId={theme}>
      <div className="relative mb-12 w-full">
        <div className="mb-6 flex flex-col gap-2 sm:absolute sm:right-0 sm:top-0 sm:z-20 sm:mb-0 sm:flex-row">
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
            className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300"
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
        </div>

        <header className="relative w-full pt-2 pr-0 sm:pr-[22rem]">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span style={{ color: "var(--boutique-header-word)" }}>Boutique </span>
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, var(--boutique-header-accent-from), var(--boutique-header-accent-to))`,
              }}
            >
              {storeLabel}
            </span>
          </h1>

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
              {themeDef.family} · {themeDef.index + 1}/{1024}
            </span>
          </div>

          {tagline?.trim() ? (
            <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--boutique-header-muted)" }}>
              {tagline.trim()}
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
          <article
            key={product.id}
            className="group rounded-3xl border p-3 backdrop-blur-xl transition-all duration-500 hover:-translate-y-1"
            style={{
              background: "var(--boutique-card-bg)",
              borderColor: "var(--boutique-card-border)",
              boxShadow: "var(--boutique-card-shadow)",
            }}
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white">
              <Image
                src={product.image}
                alt={product.title}
                fill
                className="object-contain p-4 transition duration-500 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                unoptimized={product.image.startsWith("http") || product.image.startsWith("/uploads")}
              />
              {product.isOutOfStock ? (
                <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
                  Out of stock
                </span>
              ) : null}
            </div>

            <div className="p-4 pt-4">
              <h2 className="text-lg font-bold leading-tight" style={{ color: "var(--boutique-card-title)" }}>
                {product.title}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--boutique-card-muted)" }}>
                Checkout sécurisé · Livraison Affisell
              </p>
              <p className="mt-3 text-2xl font-extrabold tracking-tight" style={{ color: "var(--boutique-price)" }}>
                {product.priceLabel}
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/boutique/${encodeURIComponent(storeSlug)}?productId=${encodeURIComponent(product.id)}`
                  )
                }
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-white transition-all duration-300 group-hover:scale-[1.01]"
                style={{
                  backgroundImage: "linear-gradient(90deg, var(--boutique-button-from), var(--boutique-button-to))",
                  boxShadow: "var(--boutique-button-shadow)",
                }}
              >
                <Eye className="size-4" aria-hidden />
                Voir le produit
              </button>
            </div>
          </article>
        ))}
      </div>

      <footer
        className="mt-12 w-full border-t pt-6 text-center text-xs"
        style={{
          borderColor: "var(--boutique-footer-border)",
          color: "var(--boutique-footer-text)",
        }}
      >
        Boutique {storeSlug} · Propulsé par Affisell · {themeDef.label}
      </footer>

      <AIPersonalizeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        storeSlug={storeSlug}
        selectedTheme={theme}
        onThemeSelect={applyTheme}
        onGenerate={handleGenerateFromModal}
        onRegenerateDescription={handleRegenerate}
        generating={regenerating}
      />
    </ResellerBoutiquePageShell>
  )
}
