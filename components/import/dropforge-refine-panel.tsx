"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, MessageSquarePlus, Sparkles, Wand2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  auditDropForgePreview,
  type DropForgePreviewGap,
  type DropForgeRefineQuickAction,
} from "@/lib/dropforge-refine-audit"
import { dropforgeHttpErrorMessage } from "@/lib/dropforge-fetch-error"
import { readJsonResponse } from "@/lib/read-json-response"
import type { AppLocale } from "@/lib/i18n-locale"
import { cn } from "@/lib/utils"

type RefineMessage = {
  role: "user" | "assistant"
  text: string
}

type Props = {
  preview: Record<string, unknown>
  onPreviewUpdate: (next: Record<string, unknown>, meta?: { applied?: string[] }) => void
}

const QUICK_CHIPS: DropForgeRefineQuickAction[] = [
  "images",
  "description",
  "variants",
  "specs",
  "category",
]

const CHIP_KEY: Record<string, string> = {
  images: "Images",
  description: "Description",
  variants: "Variants",
  specs: "Specs",
  category: "Category",
}

const GAP_KEY: Record<string, string> = {
  title: "Title",
  description: "Description",
  images: "Images",
  gallery: "Gallery",
  cost: "Cost",
  variants: "Variants",
  specs: "Specs",
  category: "Category",
  brand: "Brand",
}

export function DropForgeRefinePanel({ preview, onPreviewUpdate }: Props) {
  const t = useTranslations("importPage")
  const uiLocale = useLocale() as AppLocale
  /** The refine API writes catalog copy in FR or EN only; the UI language is independent. */
  const contentLocale = uiLocale === "en" ? "en" : "fr"
  const imageCount = Array.isArray(preview.images) ? preview.images.length : 0
  const [instruction, setInstruction] = useState("")
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<RefineMessage[]>([])
  const [gaps, setGaps] = useState<DropForgePreviewGap[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setGaps(auditDropForgePreview(preview))
  }, [preview])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const runRefine = useCallback(
    async (text: string, quickAction?: DropForgeRefineQuickAction) => {
      const trimmed = text.trim()
      if (!trimmed && !quickAction) return

      const userText =
        trimmed ||
        (quickAction ? t(`quick${CHIP_KEY[quickAction] ?? "Images"}`) : "")

      setMessages((m) => [...m, { role: "user", text: userText }])
      setBusy(true)

      try {
        const res = await fetch("/api/dropforge/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            preview,
            instruction: trimmed,
            quickAction,
            locale: contentLocale,
          }),
        })
        const data = await readJsonResponse<{
          error?: string
          preview?: Record<string, unknown>
          message?: string
          applied?: string[]
          gaps?: DropForgePreviewGap[]
          warnings?: string[]
        }>(res)

        if (!res.ok || !data.preview) {
          throw new Error(dropforgeHttpErrorMessage(res, data, uiLocale))
        }

        onPreviewUpdate(data.preview, { applied: data.applied })
        setGaps(data.gaps ?? auditDropForgePreview(data.preview))

        const assistantParts = [data.message ?? t("refineDone")]
        if (data.applied?.length) {
          assistantParts.push(t("refineApplied", { list: data.applied.join(", ") }))
        }
        if (data.warnings?.length) {
          assistantParts.push(...data.warnings)
        }

        setMessages((m) => [
          ...m,
          { role: "assistant", text: assistantParts.join("\n") },
        ])
        setInstruction("")
      } catch (e) {
        const err = e instanceof Error ? e.message : t("refineError")
        setMessages((m) => [...m, { role: "assistant", text: err }])
      } finally {
        setBusy(false)
      }
    },
    [contentLocale, onPreviewUpdate, preview, t, uiLocale]
  )

  return (
    <div
      className="mt-4 overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-950/40 via-violet-950/30 to-zinc-950/80"
      data-testid="dropforge-refine-panel"
    >
      <div className="border-b border-white/10 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200">
          <Sparkles className="size-3.5" aria-hidden />
          DropForge Co-Pilot
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {t("refineIntro")}
        </p>
        {gaps.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {gaps.slice(0, 6).map((g) => (
              <span
                key={g.id}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  g.severity === "blocker"
                    ? "bg-rose-500/20 text-rose-100"
                    : g.severity === "warning"
                      ? "bg-amber-500/15 text-amber-100"
                      : "bg-white/10 text-zinc-300"
                )}
                title={t(`gapHint${GAP_KEY[g.id] ?? "Title"}`, { count: imageCount })}
              >
                {t(`gap${GAP_KEY[g.id] ?? "Title"}`)}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-emerald-300/90">
            {t("refineComplete")}
          </p>
        )}
      </div>

      {messages.length > 0 ? (
        <div
          ref={scrollRef}
          className="max-h-44 space-y-2 overflow-y-auto border-b border-white/5 px-4 py-3 text-xs"
        >
          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={cn(
                "rounded-xl px-3 py-2 leading-relaxed",
                msg.role === "user"
                  ? "ml-6 bg-violet-600/20 text-violet-50"
                  : "mr-6 bg-black/40 text-zinc-200"
              )}
            >
              {msg.text}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {QUICK_CHIPS.map((action) => (
          <button
            key={action}
            type="button"
            disabled={busy}
            onClick={() => void runRefine("", action)}
            className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            <Wand2 className="mr-1 inline size-3 opacity-70" aria-hidden />
            {t(`chip${CHIP_KEY[action]}`)}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2 p-4 pt-3"
        onSubmit={(e) => {
          e.preventDefault()
          void runRefine(instruction)
        }}
      >
        <label className="sr-only" htmlFor="dropforge-refine-input">
          {t("refineInputLabel")}
        </label>
        <input
          id="dropforge-refine-input"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={busy}
          placeholder={t("refinePlaceholder")}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400/40"
        />
        <Button
          type="submit"
          size="sm"
          disabled={busy || !instruction.trim()}
          className="shrink-0 rounded-xl bg-cyan-600 hover:bg-cyan-500"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <MessageSquarePlus className="size-4" aria-hidden />
          )}
          <span className="ml-1.5 hidden sm:inline">
            {t("refinePatch")}
          </span>
        </Button>
      </form>
    </div>
  )
}
