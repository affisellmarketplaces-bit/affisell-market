import {
  BatteryFull,
  Bluetooth,
  Camera,
  Check,
  Droplets,
  Gem,
  HeartPulse,
  Monitor,
  Ruler,
  ShieldCheck,
  Truck,
  Volume2,
  Weight,
  Wifi,
  Zap,
  Activity,
  type LucideIcon,
} from "lucide-react"

import type { HighlightIcon, ProductHighlight } from "@/lib/product-highlights"
import { cn } from "@/lib/utils"

const ICONS: Record<HighlightIcon, LucideIcon> = {
  screen: Monitor,
  health: HeartPulse,
  sport: Activity,
  battery: BatteryFull,
  water: Droplets,
  camera: Camera,
  bluetooth: Bluetooth,
  wifi: Wifi,
  power: Zap,
  warranty: ShieldCheck,
  material: Gem,
  size: Ruler,
  weight: Weight,
  shipping: Truck,
  sound: Volume2,
  check: Check,
}

type Props = {
  highlights: readonly ProductHighlight[]
  className?: string
  ariaLabel?: string
}

/**
 * Icon chips for the 2–4 key benefits of a product. Purely presentational.
 * Photo rule: these live in a row UNDER the photo — there is deliberately no overlay layout.
 */
export function ProductHighlightChips({ highlights, className, ariaLabel }: Props) {
  if (highlights.length === 0) return null

  return (
    <ul
      aria-label={ariaLabel}
      className={cn(
        "flex snap-x gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {highlights.map((h) => {
        const Icon = ICONS[h.icon] ?? Check
        return (
          <li
            key={`${h.icon}-${h.label}`}
            className={cn(
              "inline-flex max-w-full shrink-0 snap-start items-center gap-2 rounded-full border border-white/80 bg-white/90 py-1.5 pl-2 pr-3.5 text-[12px] font-medium text-zinc-800 shadow-[0_6px_18px_-8px_rgba(76,29,149,0.35)] backdrop-blur-md",
              "dark:border-white/10 dark:bg-zinc-900/85 dark:text-zinc-100"
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 truncate">{h.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
