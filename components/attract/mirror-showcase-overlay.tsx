"use client"

import { useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"

import { MirrorFloatingProduct } from "@/components/attract/mirror-floating-product"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import {
  mirrorProductPose,
  type MirrorShowcaseProduct,
} from "@/lib/mirror-showcase-shared"
import { cn } from "@/lib/utils"

type Props = {
  products: MirrorShowcaseProduct[]
  onDismiss: () => void
}

export function MirrorShowcaseOverlay({ products, onDismiss }: Props) {
  const t = useTranslations("mirrorAttract")
  const reducedMotion = usePrefersReducedMotion()

  const handleBackdrop = useCallback(() => {
    onDismiss()
  }, [onDismiss])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onDismiss])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const visibleProducts = products.slice(0, 16)

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-[#0b0820]/92 backdrop-blur-xl animate-in fade-in duration-500"
      role="dialog"
      aria-modal="true"
      aria-label={t("ariaLabel")}
      onClick={handleBackdrop}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700/35 via-indigo-900/50 to-sky-950/45" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.045]" />
        <div className="affisell-hero-orb affisell-hero-orb--violet absolute -left-1/4 top-0 h-full w-[55%] rounded-full opacity-70" />
        <div className="affisell-hero-orb affisell-hero-orb--sky absolute -right-1/4 top-1/4 h-[80%] w-[50%] rounded-full opacity-60" />
      </div>

      <div className="relative h-full w-full max-w-[1400px]">
        <div className="absolute inset-x-0 top-[8%] z-40 flex flex-col items-center px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-100/90 backdrop-blur-md">
            {t("eyebrow")}
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-md text-sm text-violet-100/80">{t("subtitle")}</p>
          <p className="mt-3 text-xs text-violet-200/70">{t("hint")}</p>
        </div>

        <div className="absolute inset-0 overflow-hidden">
          {visibleProducts.map((product, index) => {
            const pose = mirrorProductPose(index, visibleProducts.length)
            if (reducedMotion) {
              const col = index % 4
              const row = Math.floor(index / 4)
              return (
                <div
                  key={product.id}
                  className="absolute"
                  style={{
                    left: `${12 + col * 22}%`,
                    top: `${28 + row * 14}%`,
                    width: "5rem",
                  }}
                >
                  <MirrorFloatingProduct
                    product={product}
                    pose={{ ...pose, xPct: 50, yPct: 50 }}
                    reducedMotion
                    onSelect={() => onDismiss()}
                  />
                </div>
              )
            }
            return (
              <MirrorFloatingProduct
                key={product.id}
                product={product}
                pose={pose}
                onSelect={() => onDismiss()}
              />
            )
          })}
        </div>

        {!reducedMotion ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] overflow-hidden"
            aria-hidden
          >
            <div
              className="absolute inset-0 scale-y-[-1]"
              style={{
                maskImage: "linear-gradient(to bottom, transparent 0%, black 35%, black 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 35%, black 100%)",
              }}
            >
              {visibleProducts.slice(0, 10).map((product, index) => (
                <MirrorFloatingProduct
                  key={`mirror-${product.id}`}
                  product={product}
                  pose={{
                    ...mirrorProductPose(index, 10),
                    yPct: 88 - mirrorProductPose(index, 10).yPct * 0.35,
                  }}
                  mirrored
                />
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b0820] to-transparent" />
          </div>
        ) : null}

        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-8 z-50 flex justify-center px-4",
            "animate-pulse motion-reduce:animate-none"
          )}
        >
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-violet-100/85 backdrop-blur-md">
            {t("brandPulse")}
          </span>
        </div>
      </div>
    </div>
  )
}
