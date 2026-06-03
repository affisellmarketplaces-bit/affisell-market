"use client"

import { useState, useTransition } from "react"
import { motion } from "framer-motion"
import { Loader2, Sparkles, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { ShoppingBag, Store, Users } from "lucide-react"

import { enterDemoLabAction, type DemoLabEnterError } from "@/app/actions/demo-lab-enter"
import { DEMO_PERSONAS, type DemoPersonaKey } from "@/lib/demo/demo-shared"
import { cn } from "@/lib/utils"

const PERSONA_ICONS: Record<DemoPersonaKey, LucideIcon> = {
  supplier: Store,
  affiliate: Users,
  buyer: ShoppingBag,
}

type Labels = {
  eyebrow: string
  title: string
  subtitle: string
  badge: string
  enter: string
  entering: string
  disabled: string
  notConfigured: string
  rateLimited: string
  signinFailed: string
  personas: Record<DemoPersonaKey, { title: string; hint: string }>
}

type Props = {
  enabled: boolean
  configured: boolean
  labels: Labels
  /** When set, only show this persona (journey page). */
  focusPersona?: DemoPersonaKey
}

export function DemoSandboxPortal({ enabled, configured, labels, focusPersona }: Props) {
  const [error, setError] = useState<DemoLabEnterError | null>(null)
  const [pendingPersona, setPendingPersona] = useState<DemoPersonaKey | null>(null)
  const [isPending, startTransition] = useTransition()

  const personas = focusPersona ? [focusPersona] : DEMO_PERSONAS
  const showGrid = !focusPersona

  if (!enabled) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-300/80 bg-zinc-50/80 px-4 py-3 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
        {labels.disabled}
      </p>
    )
  }

  if (!configured) {
    return (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-center text-xs text-amber-800 dark:text-amber-200/90">
        {labels.notConfigured}
      </p>
    )
  }

  const errorMessage =
    error === "rate_limited"
      ? labels.rateLimited
      : error === "signin_failed"
        ? labels.signinFailed
        : error === "not_configured"
          ? labels.notConfigured
          : null

  function onEnter(persona: DemoPersonaKey) {
    setError(null)
    setPendingPersona(persona)
    startTransition(async () => {
      const result = await enterDemoLabAction(persona)
      if (!result.ok) {
        setError(result.error)
        setPendingPersona(null)
      }
    })
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-violet-400/30 p-[1px]",
        "bg-gradient-to-br from-violet-500/40 via-fuchsia-500/20 to-cyan-500/30",
        "shadow-[0_0_60px_-12px_rgba(139,92,246,0.45)]"
      )}
      aria-labelledby="demo-sandbox-title"
    >
      <div className="relative rounded-[calc(1.5rem-1px)] bg-zinc-950/95 px-5 py-8 text-white sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-violet-600/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200">
            <Sparkles className="h-3 w-3" aria-hidden />
            {labels.eyebrow}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {labels.badge}
          </span>
        </div>

        <h2 id="demo-sandbox-title" className="relative mt-4 text-xl font-bold tracking-tight sm:text-2xl">
          {labels.title}
        </h2>
        <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{labels.subtitle}</p>

        <ul
          className={cn(
            "relative mt-8 gap-3",
            showGrid ? "grid sm:grid-cols-3" : "flex flex-col"
          )}
        >
          {personas.map((persona, i) => {
            const Icon = PERSONA_ICONS[persona]
            const loading = isPending && pendingPersona === persona
            return (
              <motion.li
                key={persona}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
              >
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onEnter(persona)}
                  className={cn(
                    "group flex w-full flex-col rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition",
                    "hover:border-violet-400/50 hover:bg-violet-500/10 hover:shadow-lg hover:shadow-violet-500/10",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400",
                    "disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-violet-100 ring-1 ring-white/10">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="mt-4 font-semibold text-white">{labels.personas[persona].title}</span>
                  <span className="mt-1 text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                    {labels.personas[persona].hint}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-300">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {labels.entering}
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" aria-hidden />
                        {labels.enter}
                      </>
                    )}
                  </span>
                </button>
              </motion.li>
            )
          })}
        </ul>

        {errorMessage ? (
          <p className="relative mt-4 text-center text-xs text-rose-300" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </section>
  )
}
