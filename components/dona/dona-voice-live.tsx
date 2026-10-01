"use client"

import { AudioLines, Mic, PhoneOff } from "lucide-react"

import { DonaAvatarImage } from "@/components/dona/dona-avatar-image"
import type { DonaVoicePhase } from "@/components/dona/use-dona-voice"

type Copy = {
  listening: string
  transcribing: string
  speaking: string
  liveOn: string
  hangupAria: string
}

export function DonaVoiceLiveStage({
  phase,
  level,
  interim,
  onHangup,
  copy,
}: {
  phase: DonaVoicePhase
  level: number
  interim: string
  onHangup: () => void
  copy: Copy
}) {
  const label =
    phase === "listening"
      ? copy.listening
      : phase === "transcribing"
        ? copy.transcribing
        : phase === "speaking"
          ? copy.speaking
          : copy.liveOn

  return (
    <div className="mx-auto mb-1 flex w-full max-w-[92%] flex-col items-center rounded-2xl border border-violet-400/25 bg-violet-500/10 px-3 py-3">
      <div className="relative flex size-16 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full bg-violet-500/25"
          style={{ transform: `scale(${1 + level * 0.55})`, opacity: 0.35 + level * 0.5 }}
          aria-hidden
        />
        <span
          className="absolute -inset-2 rounded-full border border-violet-300/30"
          style={{ transform: `scale(${1 + level * 0.35})` }}
          aria-hidden
        />
        <DonaAvatarImage
          className="relative size-14 rounded-full object-cover object-top ring-2 ring-violet-300/50"
          alt=""
          loading="lazy"
          variant="circle"
        />
      </div>
      <div className="mt-2 flex h-6 items-end gap-[3px]" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => {
          const wave = 6 + level * 18 * (0.45 + ((i + 1) % 4) * 0.2)
          return (
            <span
              key={i}
              className="w-[3px] rounded-full bg-violet-300"
              style={{ height: `${wave}px` }}
            />
          )
        })}
      </div>
      <p className="mt-1 text-center text-[11px] font-medium uppercase tracking-wide text-violet-100">
        {label}
      </p>
      {interim ? (
        <p className="mt-1 line-clamp-2 text-center text-xs text-white/70">{interim}</p>
      ) : null}
      <button
        type="button"
        onClick={onHangup}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_0_12px_rgba(239,68,68,0.35)]"
        aria-label={copy.hangupAria}
      >
        <PhoneOff className="size-3.5" />
        {copy.hangupAria}
      </button>
    </div>
  )
}

export function DonaVoiceControls({
  live,
  phase,
  supported,
  busy,
  micAria,
  liveAria,
  stopAria,
  onMicDown,
  onMicUp,
  onToggleLive,
}: {
  live: boolean
  phase: DonaVoicePhase
  supported: boolean
  busy: boolean
  micAria: string
  liveAria: string
  stopAria: string
  onMicDown: () => void
  onMicUp: () => void
  onToggleLive: () => void
}) {
  const listening = phase === "listening"

  return (
    <>
      <button
        type="button"
        disabled={!supported || busy}
        onClick={onToggleLive}
        className={`flex size-11 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 ${
          live
            ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.35)]"
            : "border-white/10 bg-[#1A1A3D] text-white/80 hover:border-violet-400/40 hover:text-white"
        }`}
        aria-label={live ? stopAria : liveAria}
        aria-pressed={live}
        title={live ? stopAria : liveAria}
      >
        <AudioLines className="size-4" />
      </button>
      <button
        type="button"
        disabled={!supported || busy || live}
        onPointerDown={(e) => {
          e.preventDefault()
          onMicDown()
        }}
        onPointerUp={onMicUp}
        onPointerLeave={onMicUp}
        onPointerCancel={onMicUp}
        className={`flex size-11 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 ${
          listening
            ? "border-violet-300 bg-violet-500 text-white shadow-[0_0_16px_rgba(124,58,237,0.55)]"
            : "border-white/10 bg-[#1A1A3D] text-white/80 hover:border-violet-400/40 hover:text-white"
        }`}
        aria-label={micAria}
        title={micAria}
      >
        <Mic className="size-4" />
      </button>
    </>
  )
}
