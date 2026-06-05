"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  title: string
  description?: string
  children?: ReactNode
  className?: string
  colSpan?: "default" | "wide"
  variant?: "default" | "glass-indigo"
}

export function BentoCard({
  title,
  description,
  children,
  className,
  colSpan = "default",
  variant = "default",
}: Props) {
  const isGlass = variant === "glass-indigo"

  return (
    <motion.div
      className={cn(
        "group relative overflow-hidden rounded-3xl p-5 transition-shadow duration-200",
        isGlass
          ? "border border-white/15 bg-gradient-to-br from-[#1E1B4B]/90 via-[#312E81]/85 to-[#1E3A8A]/90 text-white shadow-lg shadow-violet-950/25 backdrop-blur-xl hover:shadow-xl hover:shadow-violet-950/35"
          : "border border-zinc-200/80 bg-white shadow-sm hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-950",
        colSpan === "wide" && "md:col-span-2",
        className
      )}
      whileHover={{ scale: 1.02, rotateX: 3, rotateY: -3 }}
      transition={{ duration: 0.2 }}
      style={{ transformPerspective: 900 }}
    >
      {isGlass ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.04]"
          aria-hidden
        />
      ) : null}
      <h3
        className={cn(
          "relative text-sm font-semibold",
          isGlass ? "text-white" : "text-zinc-900 dark:text-zinc-50"
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            "relative mt-1 text-xs",
            isGlass ? "text-violet-100/80" : "text-zinc-500 dark:text-zinc-400"
          )}
        >
          {description}
        </p>
      ) : null}
      {children ? <div className="relative mt-4">{children}</div> : null}
    </motion.div>
  )
}
