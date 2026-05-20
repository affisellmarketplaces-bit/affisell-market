"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  title: string
  description: string
  icon: LucideIcon
  className?: string
}

export function FeatureCard({ title, description, icon: Icon, className }: Props) {
  return (
    <motion.article
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
      whileHover={{ scale: 1.02, rotateX: 2, rotateY: -2 }}
      transition={{ duration: 0.2 }}
      style={{ transformPerspective: 800 }}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
    </motion.article>
  )
}
