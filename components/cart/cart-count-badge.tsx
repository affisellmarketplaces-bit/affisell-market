"use client"

import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

type Props = {
  count: number
  size?: "sm" | "md"
  className?: string
}

export function CartCountBadge({ count, size = "md", className }: Props) {
  if (count <= 0) return null

  const label = count > 99 ? "99+" : count > 9 ? "9+" : String(count)

  return (
    <motion.span
      key={count}
      initial={{ scale: 0.45, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
      className={cn(
        "pointer-events-none absolute z-10 flex items-center justify-center rounded-full font-black tabular-nums leading-none text-white",
        "bg-gradient-to-br from-rose-600 via-red-600 to-rose-700",
        "ring-2 ring-white shadow-[0_0_14px_-2px_rgba(239,68,68,0.85)]",
        "dark:ring-zinc-950",
        size === "sm"
          ? "-right-0.5 top-0 h-4 min-w-4 px-1 text-[9px]"
          : "-right-1 -top-1 h-[18px] min-w-[18px] px-1 text-[10px]",
        className
      )}
      aria-hidden
    >
      {label}
    </motion.span>
  )
}
