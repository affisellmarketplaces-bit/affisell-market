import * as React from "react"

import { cn } from "@/lib/utils"

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Taller control for dashboard / bento forms. */
  bento?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", bento, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex w-full border text-sm text-foreground shadow-xs transition outline-none placeholder:text-muted-foreground focus-visible:border-[#7C3AED]/40 focus-visible:ring-2 focus-visible:ring-[#7C3AED]/25 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          bento
            ? "h-12 rounded-xl border-gray-200 bg-white/50 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-950/50"
            : "h-9 rounded-lg border border-input bg-background px-3 py-2 focus-visible:ring-violet-500",
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
