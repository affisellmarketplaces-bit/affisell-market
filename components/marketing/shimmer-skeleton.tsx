import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

export function ShimmerSkeleton({ className }: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-zinc-200/80 dark:bg-zinc-800",
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10" />
    </div>
  )
}
