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
}

export function BentoCard({ title, description, children, className, colSpan = "default" }: Props) {
  return (
    <motion.div
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-950",
        colSpan === "wide" && "md:col-span-2",
        className
      )}
      whileHover={{ scale: 1.02, rotateX: 3, rotateY: -3 }}
      transition={{ duration: 0.2 }}
      style={{ transformPerspective: 900 }}
    >
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      {description ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </motion.div>
  )
}
