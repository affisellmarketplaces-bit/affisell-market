"use client"

import { useRouter } from "next/navigation"

import type { MirrorProductPose, MirrorShowcaseProduct } from "@/lib/mirror-showcase-shared"
import { cn } from "@/lib/utils"

type Props = {
  product: MirrorShowcaseProduct
  pose: MirrorProductPose
  mirrored?: boolean
  reducedMotion?: boolean
  onSelect?: (product: MirrorShowcaseProduct) => void
}

export function MirrorFloatingProduct({
  product,
  pose,
  mirrored = false,
  reducedMotion = false,
  onSelect,
}: Props) {
  const router = useRouter()
  const depthStyles =
    pose.depth === 0
      ? "opacity-95 blur-0 z-30"
      : pose.depth === 1
        ? "opacity-75 blur-[0.5px] z-20"
        : "opacity-55 blur-[1px] z-10"

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect?.(product)
    router.push(product.href)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2",
        "group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80",
        depthStyles,
        mirrored && "pointer-events-none",
        !mirrored && "cursor-pointer",
        !reducedMotion && !mirrored && "animate-mirror-float motion-reduce:animate-none"
      )}
      style={{
        left: `${pose.xPct}%`,
        top: `${pose.yPct}%`,
        width: `${pose.sizeRem}rem`,
        ["--mirror-rotate" as string]: `${pose.rotateDeg}deg`,
        animationDelay: `${pose.delaySec}s`,
        animationDuration: `${pose.durationSec}s`,
      }}
      aria-label={product.title}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-white/10 shadow-lg shadow-violet-950/40 backdrop-blur-md transition duration-300",
          mirrored
            ? "border-white/10 opacity-40"
            : "border-white/25 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15 hover:shadow-xl hover:shadow-violet-500/30"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,transparent_35%,rgba(255,255,255,0.16)_50%,transparent_65%)]"
          aria-hidden
        />
        <div className="relative aspect-square w-full overflow-hidden bg-violet-950/30">
          {/* eslint-disable-next-line @next/next/no-img-element -- mixed CDN + proxy URLs */}
          <img
            src={product.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
            loading="lazy"
            decoding="async"
          />
        </div>
        {!mirrored ? (
          <p className="relative line-clamp-2 px-2 py-1.5 text-left text-[10px] font-medium leading-tight text-white/90 sm:text-[11px]">
            {product.title}
          </p>
        ) : null}
      </div>
    </button>
  )
}
