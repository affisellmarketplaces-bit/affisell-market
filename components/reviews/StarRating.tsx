"use client"

import { Star } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  value: number
  onChange?: (value: number) => void
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeMap = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-8 w-8",
}

export function StarRating({ value, onChange, size = "md", className }: Props) {
  const starClass = sizeMap[size]
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value)
        const Comp = onChange ? "button" : "span"
        return (
          <Comp
            key={n}
            type={onChange ? "button" : undefined}
            className={cn(
              onChange && "rounded p-0.5 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
            )}
            onClick={onChange ? () => onChange(n) : undefined}
            aria-label={onChange ? `Rate ${n} stars` : undefined}
          >
            <Star
              className={cn(
                starClass,
                filled ? "fill-amber-400 text-amber-400" : "fill-transparent text-zinc-400 dark:text-zinc-600"
              )}
              aria-hidden
            />
          </Comp>
        )
      })}
    </div>
  )
}
