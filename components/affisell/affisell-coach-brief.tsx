"use client"

import { Sparkles } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState, type ReactNode } from "react"

import {
  readCoachDismissed,
  writeCoachDismissed,
} from "@/lib/affisell-coach-storage"
import { cn } from "@/lib/utils"

type Props = {
  surface: string
  version?: string
  force?: boolean
  suppress?: boolean
  eyebrow: string
  title: string
  body: string
  cta: string
  dismissLabel: string
  children?: ReactNode
  className?: string
  testId?: string
}

/**
 * Shared Affisell Command Brief chrome — epoxy, dismissible, localStorage-backed.
 * Overlay sibling only; never wrap e2e targets.
 */
export function AffisellCoachBrief({
  surface,
  version = "v1",
  force = false,
  suppress = false,
  eyebrow,
  title,
  body,
  cta,
  dismissLabel,
  children,
  className,
  testId = "affisell-coach-brief",
}: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (suppress) {
      setOpen(false)
      return
    }
    if (force) {
      setOpen(true)
      return
    }
    setOpen(!readCoachDismissed(surface, version))
  }, [force, suppress, surface, version])

  useEffect(() => {
    if (!open) return
    console.log("[coach]", { surface, result: "shown" })
  }, [open, surface])

  function dismiss() {
    writeCoachDismissed(surface, version)
    console.log("[coach]", { surface, result: "dismissed" })
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn(
            "fixed inset-x-0 bottom-0 z-[90] flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 sm:inset-0 sm:items-center sm:pb-8",
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid={testId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${testId}-title`}
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#020617]/70 backdrop-blur-[2px]"
            aria-label={dismissLabel}
            onClick={dismiss}
          />
          <motion.div
            className={cn(
              "relative z-[1] w-full max-w-[22rem] overflow-hidden rounded-[1.5rem]",
              "border border-cyan-300/25 bg-[#070b14]/94 p-4 shadow-[0_24px_64px_rgb(2_6_23_/_0.65)] sm:p-5"
            )}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-cyan-400/15 blur-3xl"
              aria-hidden
            />
            <p className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/90">
              <Sparkles className="size-3.5" aria-hidden />
              {eyebrow}
            </p>
            <h2
              id={`${testId}-title`}
              className="relative mt-1.5 text-lg font-semibold tracking-tight text-white"
            >
              {title}
            </h2>
            <p className="relative mt-1.5 text-[13px] leading-relaxed text-white/65">{body}</p>
            {children ? <div className="relative mt-4">{children}</div> : null}
            <button
              type="button"
              onClick={dismiss}
              className={cn(
                "relative mt-4 flex w-full items-center justify-center rounded-xl px-4 py-3",
                "bg-gradient-to-r from-cyan-500 to-teal-500 text-sm font-bold text-white",
                "shadow-[0_12px_32px_rgb(6_182_212_/_0.4)] transition active:scale-[0.98]"
              )}
              data-testid={`${testId}-dismiss`}
            >
              {cta}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
