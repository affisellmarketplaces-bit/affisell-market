import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

/** Séparateur futuriste — trois tirets gradient entre les bandes home. */
export function HomeSectionTriDash({ className }: Props) {
  return (
    <div
      className={cn("relative flex items-center justify-center gap-2 py-5 sm:gap-3 sm:py-7", className)}
      aria-hidden
    >
      <span className="h-px max-w-[5rem] flex-1 bg-gradient-to-r from-transparent via-violet-300/30 to-violet-400/50 dark:via-violet-500/20 dark:to-violet-400/40" />
      <span className="flex items-center gap-1.5 sm:gap-2">
        <span className="h-0.5 w-5 rounded-full bg-gradient-to-r from-violet-400/40 to-violet-500/80 sm:w-7" />
        <span className="h-0.5 w-8 rounded-full bg-gradient-to-r from-fuchsia-400/70 via-violet-400 to-sky-400/70 sm:w-10" />
        <span className="h-0.5 w-5 rounded-full bg-gradient-to-l from-violet-400/40 to-violet-500/80 sm:w-7" />
      </span>
      <span className="h-px max-w-[5rem] flex-1 bg-gradient-to-l from-transparent via-violet-300/30 to-violet-400/50 dark:via-violet-500/20 dark:to-violet-400/40" />
    </div>
  )
}
