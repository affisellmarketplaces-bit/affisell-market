"use client"

import { Mic, MicOff, Volume2 } from "lucide-react"

import { cn } from "@/lib/utils"

export type DonaVoiceControlsProps = {
  sttSupported: boolean
  ttsSupported: boolean
  listening: boolean
  speaking: boolean
  duplex: boolean
  busy: boolean
  interim: string
  labels: {
    micAria: string
    micStopAria: string
    duplexOn: string
    duplexOff: string
    listening: string
    speaking: string
    unsupported: string
    duplexLabelOn: string
    duplexLabelOff: string
  }
  onToggleListen: () => void
  onToggleDuplex: () => void
}

/**
 * Compact voice chrome for Dona composer — mic (STT) + duplex toggle (hands-free loop).
 * Hidden entirely when the browser has neither STT nor TTS.
 */
export function DonaVoiceControls({
  sttSupported,
  ttsSupported,
  listening,
  speaking,
  duplex,
  busy,
  interim,
  labels,
  onToggleListen,
  onToggleDuplex,
}: DonaVoiceControlsProps) {
  if (!sttSupported && !ttsSupported) return null

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        {sttSupported ? (
          <button
            type="button"
            onClick={onToggleListen}
            disabled={busy && !listening}
            aria-pressed={listening}
            aria-label={listening ? labels.micStopAria : labels.micAria}
            className={cn(
              "relative flex size-10 shrink-0 items-center justify-center rounded-full border transition",
              listening
                ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.45)]"
                : "border-white/15 bg-white/5 text-white/80 hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-white",
              busy && !listening ? "opacity-40" : ""
            )}
          >
            {listening ? (
              <>
                <span
                  className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-emerald-400/25"
                  aria-hidden
                />
                <MicOff className="relative size-4" />
              </>
            ) : (
              <Mic className="size-4" />
            )}
          </button>
        ) : null}

        {sttSupported && ttsSupported ? (
          <button
            type="button"
            onClick={onToggleDuplex}
            aria-pressed={duplex}
            aria-label={duplex ? labels.duplexOn : labels.duplexOff}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-wide transition",
              duplex
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.25)]"
                : "border-white/15 bg-white/5 text-white/55 hover:border-white/25 hover:text-white/80"
            )}
          >
            <Volume2 className="size-3.5 opacity-80" aria-hidden />
            {duplex ? labels.duplexLabelOn : labels.duplexLabelOff}
          </button>
        ) : null}

        <div className="min-w-0 flex-1 text-[11px] text-white/45" aria-live="polite">
          {listening ? (
            <span className="text-emerald-200/90">
              {labels.listening}
              {interim ? ` — “${interim}”` : "…"}
            </span>
          ) : speaking ? (
            <span className="inline-flex items-center gap-1 text-cyan-200/90">
              <span className="inline-flex gap-0.5" aria-hidden>
                <span className="h-2 w-0.5 animate-pulse rounded-full bg-cyan-300" />
                <span className="h-3 w-0.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:120ms]" />
                <span className="h-2 w-0.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:240ms]" />
              </span>
              {labels.speaking}
            </span>
          ) : !sttSupported ? (
            <span>{labels.unsupported}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
