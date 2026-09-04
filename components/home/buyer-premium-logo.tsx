import { cn } from "@/lib/utils"

type Props = {
  className?: string
  showWordmark?: boolean
}

/** Affisell wordmark + gradient tile (buyer premium nav). */
export function BuyerPremiumLogo({ className, showWordmark = true }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 text-sm font-black text-white shadow-md shadow-indigo-500/25"
        aria-hidden
      >
        A
      </span>
      {showWordmark ? (
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Affisell</span>
      ) : null}
    </span>
  )
}
