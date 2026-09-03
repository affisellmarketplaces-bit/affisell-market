"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, MessageSquarePlus, Sparkles, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  auditDropForgePreview,
  dropForgeRefineQuickPrompt,
  type DropForgePreviewGap,
  type DropForgeRefineQuickAction,
} from "@/lib/dropforge-refine-audit"
import { dropforgeHttpErrorMessage } from "@/lib/dropforge-fetch-error"
import { readJsonResponse } from "@/lib/read-json-response"
import { cn } from "@/lib/utils"

type RefineMessage = {
  role: "user" | "assistant"
  text: string
}

type Props = {
  preview: Record<string, unknown>
  onPreviewUpdate: (next: Record<string, unknown>, meta?: { applied?: string[] }) => void
  locale?: "fr" | "en"
}

const QUICK_CHIPS: DropForgeRefineQuickAction[] = [
  "images",
  "description",
  "variants",
  "specs",
  "category",
]

export function DropForgeRefinePanel({ preview, onPreviewUpdate, locale = "fr" }: Props) {
  const [instruction, setInstruction] = useState("")
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<RefineMessage[]>([])
  const [gaps, setGaps] = useState<DropForgePreviewGap[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const gapLabels = useMemo(() => {
    const fr: Record<DropForgeRefineQuickAction, string> = {
      images: "Images",
      description: "Description",
      variants: "Variantes",
      specs: "Specs",
      category: "Catégorie",
      brand: "Marque",
      title: "Titre",
      cost: "Prix",
    }
    return fr
  }, [])

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
        (quickAction ? dropForgeRefineQuickPrompt(quickAction, locale) : "")

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
            locale,
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
          throw new Error(dropforgeHttpErrorMessage(res, data, locale))
        }

        onPreviewUpdate(data.preview, { applied: data.applied })
        setGaps(data.gaps ?? auditDropForgePreview(data.preview))

        const assistantParts = [data.message ?? "Fiche mise à jour."]
        if (data.applied?.length) {
          assistantParts.push(
            locale === "en"
              ? `Applied: ${data.applied.join(", ")}`
              : `Appliqué : ${data.applied.join(", ")}`
          )
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
        const err = e instanceof Error ? e.message : "Erreur Co-Pilot"
        setMessages((m) => [...m, { role: "assistant", text: err }])
      } finally {
        setBusy(false)
      }
    },
    [locale, onPreviewUpdate, preview]
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
          {locale === "en"
            ? "Explain what’s missing — DropForge patches the preview without re-importing."
            : "Expliquez ce qui manque — DropForge complète la fiche sans tout réimporter."}
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
                title={g.hint}
              >
                {g.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-emerald-300/90">
            {locale === "en" ? "Listing looks complete — refine anytime." : "Fiche complète — affinez si besoin."}
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
            {gapLabels[action]}
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
          Instruction Co-Pilot
        </label>
        <input
          id="dropforge-refine-input"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={busy}
          placeholder={
            locale === "en"
              ? "e.g. Add size 42, fix FR description, paste image URL…"
              : "ex. Ajoute la taille 42, corrige la description FR, colle une URL image…"
          }
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
            {locale === "en" ? "Patch" : "Compléter"}
          </span>
        </Button>
      </form>
    </div>
  )
}
