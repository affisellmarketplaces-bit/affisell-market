import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        /** Live / positive pulse (Modern SaaS). */
        live: "border-transparent bg-[#10B981]/15 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100",
        /** Primary brand chip. */
        accent: "border-transparent bg-[#7C3AED]/12 text-[#5b21b6] dark:bg-[#7C3AED]/25 dark:text-violet-100",
        destructive:
          "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/25 dark:text-red-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
