import { buildMarketplaceColorMeta } from "@/lib/marketplace-color-meta"
import { isMulticolorSwatch } from "@/lib/product-catalog-constants"
import type { ProductColorImageRow } from "@/lib/product-color-images"
import { cn } from "@/lib/utils"

type Props = {
  colors: string[]
  colorImages?: ProductColorImageRow[]
  max?: number
  className?: string
  sizeClassName?: string
}

/** Compact color dots — same resolver as marketplace PDP swatches. */
export function ProductColorSwatchDots({
  colors,
  colorImages = [],
  max = 8,
  className,
  sizeClassName = "h-5 w-5",
}: Props) {
  const names = colors.filter((c) => c.trim().length > 0)
  if (names.length === 0) return null

  const meta = buildMarketplaceColorMeta(names, colorImages)

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {meta.slice(0, max).map(({ name, meta: swatch }) => (
        <span
          key={name}
          title={name}
          className={cn("inline-flex shrink-0 rounded-full shadow ring-1 ring-black/15", sizeClassName)}
          style={
            isMulticolorSwatch(swatch)
              ? {
                  background:
                    "conic-gradient(at 50%_50%,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)",
                }
              : { backgroundColor: swatch.hex }
          }
        />
      ))}
    </div>
  )
}
