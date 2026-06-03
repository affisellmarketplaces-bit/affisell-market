"use client"

import { useState } from "react"
import { useLocale } from "next-intl"
import { Sparkles } from "lucide-react"

import type { DemoPersonaKey } from "@/lib/demo/demo-shared"
import { cn } from "@/lib/utils"

type Props = {
  persona: DemoPersonaKey
  stepId?: string
  labels: {
    title: string
    subtitle: string
    scoreAria: string
    commentPlaceholder: string
    emailPlaceholder: string
    submit: string
    thanks: string
    error: string
  }
}

export function DemoFeedbackForm({ persona, stepId, labels }: Props) {
  const locale = useLocale()
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (score < 1) return
    setStatus("loading")
    try {
      const res = await fetch("/api/demo/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona,
          score,
          comment: comment.trim() || undefined,
          email: email.trim() || undefined,
          stepId,
          locale,
          website,
        }),
      })
      if (!res.ok) {
        setStatus("error")
        return
      }
      setStatus("done")
    } catch {
      setStatus("error")
    }
  }

  if (status === "done") {
    return (
      <div
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-8 text-center"
        role="status"
      >
        <Sparkles className="mx-auto h-8 w-8 text-emerald-400" aria-hidden />
        <p className="mt-3 text-sm font-medium text-emerald-100">{labels.thanks}</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-violet-500/25 bg-zinc-950/90 p-6 text-white"
    >
      <h3 className="text-lg font-bold tracking-tight">{labels.title}</h3>
      <p className="mt-1 text-sm text-zinc-400">{labels.subtitle}</p>

      <div className="mt-5" role="group" aria-label={labels.scoreAria}>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={cn(
                "h-11 flex-1 rounded-xl border text-sm font-bold tabular-nums transition",
                score >= n
                  ? "border-violet-400/50 bg-violet-500/25 text-violet-100"
                  : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-600"
              )}
              aria-pressed={score === n}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="sr-only">{labels.commentPlaceholder}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={labels.commentPlaceholder}
          rows={3}
          maxLength={2000}
          className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </label>

      <label className="mt-3 block">
        <span className="sr-only">{labels.emailPlaceholder}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={labels.emailPlaceholder}
          autoComplete="email"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </label>

      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="absolute h-0 w-0 opacity-0"
        aria-hidden
      />

      {status === "error" ? (
        <p className="mt-3 text-xs text-amber-300" role="alert">
          {labels.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={score < 1 || status === "loading"}
        className="mt-5 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "loading" ? "…" : labels.submit}
      </button>
    </form>
  )
}
