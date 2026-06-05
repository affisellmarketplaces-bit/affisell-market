import { cn } from "@/lib/utils"

type Props = {
  tier: "01" | "02" | "03"
  eyebrow: string
  title: string
  className?: string
}

export function HomeDiscoverTierHeader({ tier, eyebrow, title, className }: Props) {
  return (
    <header className={cn("mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5", className)}>
      <div>
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-600/90 dark:text-violet-300/90">
          <span className="inline-flex size-5 items-center justify-center rounded-md border border-violet-400/30 bg-violet-500/10 text-[9px] font-bold text-violet-600 dark:text-violet-200">
            {tier}
          </span>
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-xl">
          {title}
        </h2>
      </div>
    </header>
  )
}
