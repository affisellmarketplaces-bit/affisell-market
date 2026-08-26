"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import { LEGAL_COCKPIT_ACCENT_TEXT_SOFT, LEGAL_COCKPIT_CALLOUT, LEGAL_COCKPIT_CTA_SOLID } from "@/components/admin/legal-cockpit-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  token: string
  signerEmail: string
  signerName?: string | null
  documentTitle: string
  documentHtml: string
}

export function LegalSignatureCanvas({
  token,
  signerEmail,
  signerName,
  documentTitle,
  documentHtml,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startDraw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawing.current = true
    canvas.setPointerCapture(e.pointerId)
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }, [])

  const draw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.strokeStyle = "#1a1a1a"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }, [])

  const endDraw = useCallback(() => {
    drawing.current = false
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#fafafa"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = "#ccc"
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
  }, [])

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#fafafa"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = "#ccc"
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
  }

  async function submitSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    setSubmitting(true)
    setError(null)
    try {
      const signatureData = canvas.toDataURL("image/png")
      const res = await fetch("/api/legal/sign/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signatureData, signerName: signerName ?? undefined }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign_failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-8 text-center">
        <p className="text-lg font-semibold text-emerald-200">Document signé</p>
        <p className="mt-2 text-sm text-emerald-100/80">
          Merci — votre signature a été enregistrée pour {documentTitle}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800">
        <iframe
          title={documentTitle}
          srcDoc={documentHtml}
          className="h-[min(50vh,480px)] w-full border-0"
          sandbox="allow-same-origin"
        />
      </div>

      <div className={LEGAL_COCKPIT_CALLOUT}>
        <p className={cn("text-sm font-medium", LEGAL_COCKPIT_ACCENT_TEXT_SOFT)}>Signature électronique</p>
        <p className="mt-1 text-xs text-zinc-400">
          Signataire : {signerName ?? signerEmail} · Loi n°2000-230 (signature simple)
        </p>
        <canvas
          ref={canvasRef}
          width={560}
          height={160}
          className="mt-3 w-full max-w-full cursor-crosshair rounded-lg border border-zinc-700 bg-zinc-50 touch-none"
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={cn(buttonVariants({ variant: "outline", size: "sm" }))} onClick={clearCanvas}>
            Effacer
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ size: "sm" }), LEGAL_COCKPIT_CTA_SOLID)}
            disabled={submitting}
            onClick={() => void submitSignature()}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Signer le document"}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      </div>
    </div>
  )
}
