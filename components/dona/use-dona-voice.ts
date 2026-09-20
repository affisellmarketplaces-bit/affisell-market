"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { AppLocale } from "@/lib/i18n-locale"
import { toDonaSpeakableText } from "@/lib/dona/voice-speakable"

export type DonaVoicePhase = "idle" | "listening" | "transcribing" | "speaking"

type SpeechRec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecCtor = new () => SpeechRec

function speechRecognitionCtor(): SpeechRecCtor | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecCtor
    webkitSpeechRecognition?: SpeechRecCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function preferredRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? ""
}

function localeToBcp47(locale: AppLocale): string {
  if (locale === "zh") return "zh-CN"
  if (locale === "en") return "en-US"
  return locale
}

function pickBrowserVoice(locale: AppLocale): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  const prefix = localeToBcp47(locale).slice(0, 2).toLowerCase()
  const pool = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix))
  const scored = (pool.length ? pool : voices).map((v) => {
    const n = v.name.toLowerCase()
    let score = 0
    if (/neural|premium|enhanced|natural/.test(n)) score += 4
    if (/samantha|amélie|amelie|thomas|google|siri|aria|jenny|nova|female|woman/.test(n)) score += 3
    if (v.localService) score += 1
    return { v, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.v ?? null
}

function rmsFromAnalyser(analyser: AnalyserNode, buffer: Uint8Array): number {
  analyser.getByteTimeDomainData(buffer as never)
  let sum = 0
  for (let i = 0; i < buffer.length; i += 1) {
    const centered = (buffer[i] ?? 128) - 128
    sum += centered * centered
  }
  return Math.sqrt(sum / buffer.length) / 128
}

export type DonaVoiceSession = {
  phase: DonaVoicePhase
  live: boolean
  level: number
  supported: boolean
  neural: boolean
  errorKey: string | null
  interim: string
  startHold: () => void
  stopHold: () => void
  toggleLive: () => void
  stopAll: () => void
  clearError: () => void
}

type Opts = {
  locale: AppLocale
  open: boolean
  busy: boolean
  lastAssistantId: string | null
  lastAssistantText: string
  welcomeText: string
  hasUserTurn: boolean
  onSend: (text: string) => void | Promise<void>
}

export function useDonaVoiceSession(opts: Opts): DonaVoiceSession {
  const [phase, setPhase] = useState<DonaVoicePhase>("idle")
  const [live, setLive] = useState(false)
  const [level, setLevel] = useState(0)
  const [supported, setSupported] = useState(false)
  const [neural, setNeural] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [interim, setInterim] = useState("")

  const liveRef = useRef(false)
  const phaseRef = useRef<DonaVoicePhase>("idle")
  const speakNextRef = useRef(false)
  const spokenIdRef = useRef<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recRef = useRef<SpeechRec | null>(null)
  const rafRef = useRef<number>(0)
  const ctxRef = useRef<AudioContext | null>(null)
  const abortSpeakRef = useRef<AbortController | null>(null)
  const bargeArmedRef = useRef(false)
  const holdStartedAtRef = useRef(0)
  const optsRef = useRef(opts)

  optsRef.current = opts
  liveRef.current = live
  phaseRef.current = phase

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    void ctxRef.current?.close().catch(() => undefined)
    ctxRef.current = null
    setLevel(0)
  }, [])

  const stopSpeak = useCallback(() => {
    abortSpeakRef.current?.abort()
    abortSpeakRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
      audioRef.current = null
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const stopListenHardware = useCallback(() => {
    try {
      recRef.current?.abort()
    } catch {
      /* already stopped */
    }
    recRef.current = null
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop()
      } catch {
        /* already stopped */
      }
    }
    recorderRef.current = null
    stopTracks()
  }, [stopTracks])

  const stopAll = useCallback(() => {
    liveRef.current = false
    setLive(false)
    speakNextRef.current = false
    stopSpeak()
    stopListenHardware()
    setInterim("")
    setPhase("idle")
  }, [stopListenHardware, stopSpeak])

  useEffect(() => {
    const can = typeof window !== "undefined" && Boolean(window.isSecureContext)
    const hasMic = can && Boolean(navigator.mediaDevices?.getUserMedia)
    const hasRec = hasMic && (typeof MediaRecorder !== "undefined" || Boolean(speechRecognitionCtor()))
    setSupported(hasRec)
    void fetch("/api/dona/voice/status", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { enabled?: boolean; neuralStt?: boolean; neuralTts?: boolean } | null) => {
        if (data && data.enabled === false) {
          setSupported(false)
          setNeural(false)
          return
        }
        setNeural(Boolean(data?.neuralStt || data?.neuralTts))
      })
      .catch(() => {
        setNeural(false)
      })
  }, [])

  useEffect(() => {
    if (!opts.open) stopAll()
  }, [opts.open, stopAll])

  const speakBrowser = useCallback(async (text: string) => {
    const speakable = toDonaSpeakableText(text)
    if (!speakable || typeof window === "undefined" || !window.speechSynthesis) return
    await new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(speakable)
      utter.lang = localeToBcp47(optsRef.current.locale)
      utter.rate = 1.04
      utter.pitch = 1.04
      const voice = pickBrowserVoice(optsRef.current.locale)
      if (voice) utter.voice = voice
      utter.onend = () => resolve()
      utter.onerror = () => resolve()
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    })
  }, [])

  const speakText = useCallback(
    async (text: string) => {
      const speakable = toDonaSpeakableText(text)
      if (!speakable) return
      stopSpeak()
      setPhase("speaking")
      const ac = new AbortController()
      abortSpeakRef.current = ac
      bargeArmedRef.current = false
      window.setTimeout(() => {
        bargeArmedRef.current = true
      }, 450)

      try {
        const res = await fetch("/api/dona/voice/speak", {
          method: "POST",
          signal: ac.signal,
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: speakable, locale: optsRef.current.locale }),
        })
        const ctype = res.headers.get("content-type") ?? ""
        if (res.ok && ctype.includes("audio")) {
          const blob = await res.blob()
          if (ac.signal.aborted) return
          const url = URL.createObjectURL(blob)
          await new Promise<void>((resolve, reject) => {
            const audio = new Audio(url)
            audioRef.current = audio
            audio.onended = () => {
              URL.revokeObjectURL(url)
              resolve()
            }
            audio.onerror = () => {
              URL.revokeObjectURL(url)
              reject(new Error("audio_el"))
            }
            void audio.play().catch(reject)
          })
          return
        }
      } catch (error) {
        if (ac.signal.aborted) return
        console.warn("[dona-voice] neural tts fallback", error instanceof Error ? error.message : String(error))
      }

      if (ac.signal.aborted) return
      await speakBrowser(speakable)
    },
    [speakBrowser, stopSpeak]
  )

  const transcribeBlob = useCallback(async (blob: Blob): Promise<string> => {
    const fd = new FormData()
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"
    fd.append("file", blob, `dona-voice.${ext}`)
    fd.append("locale", optsRef.current.locale)
    const res = await fetch("/api/dona/voice/transcribe", {
      method: "POST",
      body: fd,
      credentials: "same-origin",
    })
    if (!res.ok) throw new Error("transcribe_http")
    const data = (await res.json()) as { text?: string }
    return (data.text ?? "").trim()
  }, [])

  const submitTranscript = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) {
        setErrorKey("empty")
        setPhase("idle")
        if (liveRef.current) {
          window.setTimeout(() => {
            if (liveRef.current && phaseRef.current === "idle" && !optsRef.current.busy) {
              void startListenRef.current()
            }
          }, 400)
        }
        return
      }
      setErrorKey(null)
      speakNextRef.current = true
      setPhase("idle")
      await optsRef.current.onSend(trimmed)
    },
    []
  )

  const startListenRef = useRef<() => Promise<void>>(async () => undefined)

  const startMediaListen = useCallback(async () => {
    const mime = preferredRecorderMime()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    streamRef.current = stream

    const ctx = new AudioContext()
    ctxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    const buf = new Uint8Array(analyser.fftSize)

    let speechMs = 0
    let silenceMs = 0
    let last = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = now - last
      last = now
      const rms = rmsFromAnalyser(analyser, buf)
      setLevel(Math.min(1, rms * 6))

      if (phaseRef.current === "speaking" && liveRef.current && bargeArmedRef.current && rms > 0.085) {
        stopSpeak()
        setPhase("listening")
      }

      if (phaseRef.current === "listening") {
        if (rms > 0.045) {
          speechMs += dt
          silenceMs = 0
        } else if (speechMs > 280) {
          silenceMs += dt
          if (silenceMs > 1100) {
            recorderRef.current?.stop()
            return
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    if (!mime || typeof MediaRecorder === "undefined") {
      throw new Error("no_recorder")
    }

    const rec = new MediaRecorder(stream, { mimeType: mime })
    recorderRef.current = rec
    recChunksRef.current = []
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) recChunksRef.current.push(ev.data)
    }
    rec.onstop = () => {
      const blob = new Blob(recChunksRef.current, { type: mime.split(";")[0] })
      stopTracks()
      recorderRef.current = null
      void (async () => {
        setPhase("transcribing")
        try {
          const text = await transcribeBlob(blob)
          await submitTranscript(text)
        } catch (error) {
          console.warn("[dona-voice] transcribe", error instanceof Error ? error.message : String(error))
          setErrorKey("transcribe")
          setPhase("idle")
        }
      })()
    }
    rec.start(120)
    window.setTimeout(() => {
      if (recorderRef.current === rec && rec.state === "recording") rec.stop()
    }, 18_000)
  }, [stopSpeak, stopTracks, submitTranscript, transcribeBlob])

  const startBrowserListen = useCallback(async () => {
    const Ctor = speechRecognitionCtor()
    if (!Ctor) throw new Error("no_speech_rec")
    const rec = new Ctor()
    rec.lang = localeToBcp47(optsRef.current.locale)
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    recRef.current = rec
    rec.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1]
      const transcript = last?.[0]?.transcript ?? ""
      setInterim(transcript)
      if (transcript && (last as { isFinal?: boolean }).isFinal !== false) {
        /* keep latest */
      }
    }
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed") setErrorKey("permission")
      else if (ev.error !== "aborted" && ev.error !== "no-speech") setErrorKey("unsupported")
      setPhase("idle")
    }
    rec.onend = () => {
      const text = interimRef.current.trim()
      recRef.current = null
      setInterim("")
      void submitTranscript(text)
    }
    rec.start()
  }, [submitTranscript])

  const interimRef = useRef("")
  useEffect(() => {
    interimRef.current = interim
  }, [interim])

  startListenRef.current = async () => {
    if (!optsRef.current.open) return
    stopSpeak()
    setErrorKey(null)
    setInterim("")
    setPhase("listening")
    try {
      if (neural) {
        await startMediaListen()
      } else {
        await startBrowserListen()
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (/notallowed|permission|denied/i.test(msg)) setErrorKey("permission")
      else {
        try {
          await startBrowserListen()
        } catch {
          setErrorKey("unsupported")
          setPhase("idle")
        }
      }
    }
  }

  const startHold = useCallback(() => {
    if (!supported) {
      setErrorKey("unsupported")
      return
    }
    holdStartedAtRef.current = Date.now()
    void startListenRef.current()
  }, [supported])

  const stopHold = useCallback(() => {
    if (phaseRef.current !== "listening") return
    if (Date.now() - holdStartedAtRef.current < 420) return
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop()
      return
    }
    try {
      recRef.current?.stop()
    } catch {
      /* ignore */
    }
  }, [])

  const toggleLive = useCallback(() => {
    if (!supported) {
      setErrorKey("unsupported")
      return
    }
    if (liveRef.current) {
      stopAll()
      return
    }
    liveRef.current = true
    setLive(true)
    speakNextRef.current = true
    if (!optsRef.current.hasUserTurn) {
      spokenIdRef.current = "welcome"
      void (async () => {
        await speakText(optsRef.current.welcomeText)
        if (liveRef.current) void startListenRef.current()
        else setPhase("idle")
      })()
      return
    }
    void startListenRef.current()
  }, [speakText, stopAll, supported])

  useEffect(() => {
    if (!opts.open) return
    if (opts.busy) return
    if (!speakNextRef.current && !live) return
    if (!opts.lastAssistantId || !opts.lastAssistantText.trim()) return
    if (spokenIdRef.current === opts.lastAssistantId) return
    spokenIdRef.current = opts.lastAssistantId
    speakNextRef.current = false
    void (async () => {
      await speakText(opts.lastAssistantText)
      if (liveRef.current) void startListenRef.current()
      else setPhase("idle")
    })()
  }, [live, opts.busy, opts.lastAssistantId, opts.lastAssistantText, opts.open, speakText])

  useEffect(() => {
    if (!live || phase !== "speaking") return
    let cancelled = false
    let localStream: MediaStream | null = null
    let localCtx: AudioContext | null = null
    let raf = 0
    const buf = new Uint8Array(2048)

    void (async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
        if (cancelled) {
          localStream.getTracks().forEach((t) => t.stop())
          return
        }
        localCtx = new AudioContext()
        const source = localCtx.createMediaStreamSource(localStream)
        const analyser = localCtx.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        const tick = () => {
          if (cancelled) return
          analyser.getByteTimeDomainData(buf as never)
          let sum = 0
          for (let i = 0; i < buf.length; i += 1) {
            const centered = (buf[i] ?? 128) - 128
            sum += centered * centered
          }
          const rms = Math.sqrt(sum / buf.length) / 128
          setLevel(Math.min(1, rms * 6))
          if (bargeArmedRef.current && rms > 0.09) {
            stopSpeak()
            void startListenRef.current()
            return
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        /* barge-in optional */
      }
    })()

    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      localStream?.getTracks().forEach((t) => t.stop())
      void localCtx?.close().catch(() => undefined)
    }
  }, [live, phase, stopSpeak])

  return {
    phase,
    live,
    level,
    supported,
    neural,
    errorKey,
    interim,
    startHold,
    stopHold,
    toggleLive,
    stopAll,
    clearError: () => setErrorKey(null),
  }
}
