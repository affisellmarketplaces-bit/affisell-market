"use client"

import { motion } from "framer-motion"

export function HeroGradientBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,255,255,0.18),transparent)]" />
      <motion.div
        className="absolute -left-1/4 top-0 h-[100%] w-[55%] rounded-full bg-violet-400/30 blur-[60px] max-md:w-[45%] max-md:blur-[50px]"
        animate={{ x: [0, 24, 0], y: [0, 12, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-1/4 top-1/4 h-[80%] w-[50%] rounded-full bg-sky-400/25 blur-[70px] max-md:w-[40%] max-md:blur-[50px]"
        animate={{ x: [0, -20, 0], y: [0, 18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="absolute inset-0 opacity-[0.35] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
