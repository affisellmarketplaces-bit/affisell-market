"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type Props = ComponentProps<typeof Link> & {
  children: React.ReactNode
}

export function GlowCtaButton({ className, children, ...props }: Props) {
  return (
    <motion.div
      className="relative inline-flex"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <span
        className="pointer-events-none absolute -inset-1 rounded-2xl bg-indigo-500/40 opacity-0 blur-xl transition-opacity duration-200 group-hover:opacity-100"
        aria-hidden
      />
      <Link
        {...props}
        className={cn(
          "group relative inline-flex items-center justify-center rounded-2xl bg-[#6366F1] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition-shadow duration-200 hover:shadow-xl hover:shadow-indigo-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
          className
        )}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(600px circle at var(--x,50%) var(--y,50%), rgba(255,255,255,0.25), transparent 40%)",
          }}
          onMouseMove={(e) => {
            const el = e.currentTarget.parentElement
            if (!el) return
            const r = el.getBoundingClientRect()
            el.style.setProperty("--x", `${e.clientX - r.left}px`)
            el.style.setProperty("--y", `${e.clientY - r.top}px`)
          }}
          aria-hidden
        />
        <span className="relative">{children}</span>
      </Link>
    </motion.div>
  )
}
