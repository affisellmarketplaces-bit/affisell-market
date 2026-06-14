import type { StorefrontHeaderBrandAlign } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  description: string
  accent?: string
  align?: StorefrontHeaderBrandAlign
  className?: string
}

/** Store tagline — editorial band below chrome, aligned with Brand Studio header setting. */
export function StorefrontTaglineBand({
  description,
  accent = "#7c3aed",
  align = "center",
  className,
}: Props) {
  const text = description.trim()
  if (!text) return null

  return (
    <section
      className={cn(
        "border-b border-zinc-200/70 bg-gradient-to-b from-white via-zinc-50/40 to-transparent px-4 py-4 dark:border-zinc-800/70 dark:from-zinc-950 dark:via-zinc-900/40 sm:px-6 sm:py-5",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto max-w-6xl",
          align === "center" && "text-center",
          align === "right" && "text-right"
        )}
      >
        <p
          className={cn(
            "max-w-2xl text-[15px] font-medium leading-relaxed tracking-tight text-zinc-700 dark:text-zinc-300 sm:text-base",
            align === "center" && "mx-auto",
            align === "right" && "ml-auto"
          )}
        >
          {text}
        </p>
        <div
          className={cn(
            "mt-3 h-0.5 w-10 rounded-full opacity-80",
            align === "center" && "mx-auto",
            align === "right" && "ml-auto"
          )}
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
          aria-hidden
        />
      </div>
    </section>
  )
}
