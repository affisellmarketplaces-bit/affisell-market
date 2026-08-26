"use client"

import { useState } from "react"
import { Eye, FileCode2 } from "lucide-react"

import { LEGAL_COCKPIT_PREVIEW_TAB_ACTIVE } from "@/components/admin/legal-cockpit-ui"
import { cn } from "@/lib/utils"

export type LegalPreviewFrameProps = {
  title: string
  markdown: string
  html: string
  className?: string
  /** Hauteur zone document (iframe A4) */
  frameMinHeight?: string
}

type ViewMode = "document" | "source"

export function LegalPreviewFrame({
  title,
  markdown,
  html,
  className,
  frameMinHeight = "min-h-[520px]",
}: LegalPreviewFrameProps) {
  const [mode, setMode] = useState<ViewMode>("document")

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-1 rounded-xl border border-zinc-700/80 bg-zinc-950/80 p-1">
        <button
          type="button"
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
            mode === "document"
              ? LEGAL_COCKPIT_PREVIEW_TAB_ACTIVE
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          )}
          onClick={() => setMode("document")}
        >
          <Eye className="size-3.5" aria-hidden />
          Aperçu document
        </button>
        <button
          type="button"
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
            mode === "source"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          )}
          onClick={() => setMode("source")}
        >
          <FileCode2 className="size-3.5" aria-hidden />
          Markdown source
        </button>
      </div>

      {mode === "document" ? (
        <div
          className={cn(
            "mt-3 overflow-hidden rounded-xl border border-zinc-600/60 bg-white shadow-2xl shadow-black/50 ring-1 ring-white/10",
            frameMinHeight
          )}
        >
          <iframe
            title={title}
            srcDoc={html}
            className="h-full min-h-[inherit] w-full border-0 bg-white"
            sandbox="allow-same-origin"
          />
        </div>
      ) : (
        <pre
          className={cn(
            "mt-3 overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-700/80 bg-zinc-950/90 p-4 font-mono text-xs leading-relaxed text-zinc-200",
            frameMinHeight
          )}
        >
          {markdown}
        </pre>
      )}
    </div>
  )
}

/** Ouvre une fenêtre d'impression avec le HTML juridique print-ready. */
export function printLegalHtml(html: string, title = "Document Affisell"): void {
  const w = window.open("", "_blank", "noopener,noreferrer")
  if (!w) return
  w.document.write(html)
  w.document.title = title
  w.document.close()
  w.focus()
  requestAnimationFrame(() => {
    w.print()
  })
}
