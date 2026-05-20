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
        "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-xl dark:border-gray-800 dark:bg-zinc-950",
        className
      )}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-[#6366F1] dark:bg-indigo-950">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
    </motion.article>
  )
}
