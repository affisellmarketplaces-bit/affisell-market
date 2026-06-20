"use client"

import { isMulticolorSwatch, type CatalogColorSwatch } from "@/lib/product-catalog-constants"
import { cn } from "@/lib/utils"

export function resolveCatalogColorSwatch(
  colorName: string,
  meta?: Pick<CatalogColorSwatch, "hex" | "multicolor"> | null
): CatalogColorSwatch {
  return {
    name: colorName,
    hex: meta?.hex ?? "#8E8E93",
    ...(meta?.multicolor ? { multicolor: true } : {}),
  }
}

type Props = {
  name: string
  meta: CatalogColorSwatch
  imageUrl?: string | null
  selected: boolean
  selectedClassName: string
  unselectedClassName: string
  onClick: () => void
  sizeClassName?: string
  className?: string
}

/** Circular PDP swatch — product photo when available, else resolved hex (never theme fill). */
export function ProductColorSwatchButton({
  name,
  meta,
  imageUrl,
  selected,
  selectedClassName,
  unselectedClassName,
  onClick,
  sizeClassName = "h-11 w-11 lg:h-10 lg:w-10",
  className,
}: Props) {
  const image = imageUrl?.trim() ?? ""
  const hasImage = image.length > 0
  const isMulti = isMulticolorSwatch(meta)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border-2 transition active:scale-95",
        sizeClassName,
        selected ? selectedClassName : unselectedClassName,
        className
      )}
      style={
        hasImage || isMulti
          ? undefined
          : { backgroundColor: meta.hex }
      }
      title={name}
      aria-label={name}
      aria-pressed={selected}
    >
      {hasImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
          <span
            className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/10"
            aria-hidden
          />
        </>
      ) : isMulti ? (
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
          }}
          aria-hidden
        />
      ) : null}
    </button>
  )
}
