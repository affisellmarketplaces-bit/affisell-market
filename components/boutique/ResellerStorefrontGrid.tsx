"use client"

import Image from "next/image"
import { Eye, RotateCw, Sparkles } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { AIPersonalizeModal } from "@/components/boutique/AIPersonalizeModal"
import { ResellerBoutiquePageShell } from "@/components/boutique/reseller-boutique-page-shell"
import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"
import type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"
import {
  DEFAULT_STOREFRONT_THEME_ID,
  getStorefrontThemeTokens,
  nextStorefrontThemeId,
  parseStorefrontThemeId,
  STOREFRONT_THEMES,
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

function storeInitial(label: string): string {
  const trimmed = label.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : "B"
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

  const tokens = getStorefrontThemeTokens(theme)

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
    setTheme(nextTheme)
    toast.success(`Theme: ${STOREFRONT_THEMES[nextTheme].label} ✨`)
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
    toast.success(`Theme: ${STOREFRONT_THEMES[themeId].label} ✨`)
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
      <header className="mb-10 flex w-full flex-col gap-6 md:mb-12 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-lg ring-2",
              tokens.avatar
            )}
            aria-hidden
          >
            {storeInitial(storeLabel)}
          </span>
          <div className="min-w-0 space-y-3">
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Boutique{" "}
              <span
                className={cn(
                  "bg-gradient-to-r bg-clip-text text-transparent",
                  tokens.headerTitleGradient
                )}
              >
                {storeLabel}
              </span>
            </h1>
            {tagline?.trim() ? (
              <p className={cn("max-w-2xl text-sm leading-relaxed", tokens.headerMuted)}>
                {tagline.trim()}
              </p>
            ) : null}
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-sm",
                tokens.badge
              )}
            >
              {count} produit{count > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:scale-[1.02]",
              tokens.aiButton
            )}
          >
            <Sparkles className="size-4 shrink-0" aria-hidden />
            Personalize my store with AI ✨
          </button>
          <button
            type="button"
            title="Regenerate layout with AI"
            onClick={handleRegenerate}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300",
              tokens.regenerateButton
            )}
          >
            <RotateCw
              className={cn("size-4 shrink-0", regenerating && "animate-spin")}
              aria-hidden
            />
            ↻ Regenerate
          </button>
        </div>
      </header>

      <div
        className={cn(
          "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          tokens.gridClass,
          regenerating && "animate-pulse duration-700"
        )}
      >
        {products.map((product) => (
          <article
            key={product.id}
            className={cn(
              "group rounded-3xl border p-3 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.2)]",
              tokens.cardClass
            )}
          >
            <div className={cn("relative aspect-square overflow-hidden rounded-2xl bg-white", tokens.cardImageBg)}>
              <Image
                src={product.image}
                alt={product.title}
                fill
                className="object-contain p-4 transition duration-500 group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                unoptimized={product.image.startsWith("http") || product.image.startsWith("/uploads")}
              />
              {product.isOutOfStock ? (
                <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
                  Out of stock
                </span>
              ) : null}
            </div>

            <div className="p-4 pt-4">
              <h2 className={cn("text-lg font-bold leading-tight", tokens.cardTitle)}>{product.title}</h2>
              <p className={cn("mt-1 line-clamp-2 text-sm", tokens.cardMuted)}>
                Checkout sécurisé · Livraison Affisell
              </p>
              <p className={cn("mt-3 text-2xl font-extrabold tracking-tight", tokens.price)}>
                {product.priceLabel}
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/boutique/${encodeURIComponent(storeSlug)}?productId=${encodeURIComponent(product.id)}`
                  )
                }
                className={cn(
                  "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r text-sm font-medium text-white transition-all duration-300 hover:shadow-[0_4px_20px_rgba(109,40,217,0.4)] group-hover:scale-[1.01]",
                  tokens.buttonClass
                )}
              >
                <Eye className="size-4" aria-hidden />
                Voir le produit
              </button>
            </div>
          </article>
        ))}
      </div>

      <footer className={cn("mt-12 w-full border-t pt-6 text-center text-xs", tokens.footer)}>
        Boutique {storeSlug} · Propulsé par Affisell · {tokens.label}
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
