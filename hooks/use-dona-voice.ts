"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { AppLocale } from "@/lib/i18n-locale"
import {
  detectDonaSpeechSupport,
  donaSpeechLang,
  donaTextForSpeech,
  pickDonaTtsVoice,
  readDonaVoiceDuplexPref,
  writeDonaVoiceDuplexPref,
  type DonaSpeechSupport,
} from "@/lib/dona/dona-voice-shared"

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

type SpeechRecognitionResultEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0?: { transcript?: string }
  }>
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type UseDonaVoiceArgs = {
  locale: AppLocale
  /** When false, all voice I/O is stopped (panel closed). */
  active: boolean
  /** Chat is submitting / streaming — don't start STT. */
  busy: boolean
  /** Called with a final transcript ready to send. */
  onFinalTranscript: (text: string) => void | Promise<void>
  /** Latest completed assistant message to speak (id + text). */
  speakTarget: { id: string; text: string } | null
}

export type UseDonaVoiceResult = {
  support: DonaSpeechSupport
  listening: boolean
  speaking: boolean
  duplex: boolean
  interim: string
  setDuplex: (on: boolean) => void
  toggleListen: () => void
  stopAll: () => void
}

/**
 * Progressive voice layer for Dona: browser STT + TTS + optional duplex loop.
 * Does not touch the text chat transport — only feeds transcripts into sendMessage.
 */
export function useDonaVoice(args: UseDonaVoiceArgs): UseDonaVoiceResult {
  const { locale, active, busy, onFinalTranscript, speakTarget } = args

  const [support, setSupport] = useState<DonaSpeechSupport>({ stt: false, tts: false })
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [duplex, setDuplexState] = useState(false)
  const [interim, setInterim] = useState("")

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const duplexRef = useRef(false)
  const busyRef = useRef(busy)
  const activeRef = useRef(active)
  const wantListenRef = useRef(false)
  const spokenIdsRef = useRef<Set<string>>(new Set())
  const onFinalRef = useRef(onFinalTranscript)
  const localeRef = useRef(locale)

  useEffect(() => {
    onFinalRef.current = onFinalTranscript
  }, [onFinalTranscript])
  useEffect(() => {
    localeRef.current = locale
  }, [locale])
  useEffect(() => {
    busyRef.current = busy
  }, [busy])
  useEffect(() => {
    activeRef.current = active
  }, [active])
  useEffect(() => {
    duplexRef.current = duplex
  }, [duplex])

  useEffect(() => {
    setSupport(detectDonaSpeechSupport())
    setDuplexState(readDonaVoiceDuplexPref())
  }, [])

  const cancelSpeech = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      window.speechSynthesis?.cancel()
    } catch {
      // ignore
    }
    setSpeaking(false)
  }, [])

  const stopRecognition = useCallback((abort = false) => {
    const rec = recognitionRef.current
    recognitionRef.current = null
    wantListenRef.current = false
    setInterim("")
    setListening(false)
    if (!rec) return
    try {
      if (abort) rec.abort()
      else rec.stop()
    } catch {
      // already stopped
    }
  }, [])

  const stopAll = useCallback(() => {
    stopRecognition(true)
    cancelSpeech()
  }, [cancelSpeech, stopRecognition])

  const startListening = useCallback(() => {
    if (!activeRef.current || busyRef.current) return
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    cancelSpeech()
    stopRecognition(true)

    const recognition = new Ctor()
    recognition.lang = donaSpeechLang(localeRef.current)
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
      setInterim("")
    }

    recognition.onresult = (event) => {
      let interimBuf = ""
      let finalBuf = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i]
        const piece = row?.[0]?.transcript ?? ""
        if (!piece) continue
        if (row.isFinal) finalBuf += piece
        else interimBuf += piece
      }
      if (interimBuf) setInterim(interimBuf.trim())
      const finalText = finalBuf.trim()
      if (finalText) {
        setInterim("")
        wantListenRef.current = false
        void onFinalRef.current(finalText)
      }
    }

    recognition.onerror = (event) => {
      const code = event.error ?? "unknown"
      console.warn("[dona-voice]", { result: "stt_error", code })
      // "aborted" / "no-speech" are normal UX exits
      if (code !== "aborted" && code !== "no-speech") {
        wantListenRef.current = false
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
      setInterim("")
      // Duplex: if we still want to listen and aren't busy, restart once
      if (
        wantListenRef.current &&
        duplexRef.current &&
        activeRef.current &&
        !busyRef.current
      ) {
        window.setTimeout(() => {
          if (
            wantListenRef.current &&
            duplexRef.current &&
            activeRef.current &&
            !busyRef.current
          ) {
            startListening()
          }
        }, 280)
      }
    }

    recognitionRef.current = recognition
    wantListenRef.current = true
    try {
      recognition.start()
    } catch (error) {
      console.warn("[dona-voice]", {
        result: "stt_start_failed",
        error: error instanceof Error ? error.message : String(error),
      })
      recognitionRef.current = null
      wantListenRef.current = false
      setListening(false)
    }
  }, [cancelSpeech, stopRecognition])

  const toggleListen = useCallback(() => {
    if (listening) {
      stopRecognition(true)
      return
    }
    if (speaking) cancelSpeech()
    startListening()
  }, [cancelSpeech, listening, speaking, startListening, stopRecognition])

  const setDuplex = useCallback(
    (on: boolean) => {
      setDuplexState(on)
      writeDonaVoiceDuplexPref(on)
      duplexRef.current = on
      if (!on) {
        // leaving duplex — keep current listen if any; don't auto-loop
        wantListenRef.current = listening
      }
    },
    [listening]
  )

  // Speak assistant replies once streaming completes
  useEffect(() => {
    if (!active || !support.tts || !speakTarget) return
    if (busy) return
    const spoken = spokenIdsRef.current
    if (spoken.has(speakTarget.id)) return
    const text = donaTextForSpeech(speakTarget.text)
    if (!text) {
      spoken.add(speakTarget.id)
      return
    }

    spoken.add(speakTarget.id)
    cancelSpeech()

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = donaSpeechLang(locale)
    utter.rate = 1.02
    utter.pitch = 1.05

    const assignVoice = () => {
      const voices = window.speechSynthesis?.getVoices?.() ?? []
      const picked = pickDonaTtsVoice(voices, locale)
      if (picked) {
        // SpeechSynthesisVoice is structurally compatible
        utter.voice = picked as SpeechSynthesisVoice
      }
    }
    assignVoice()
    if (window.speechSynthesis && window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        assignVoice()
      }
    }

    utter.onstart = () => setSpeaking(true)
    utter.onend = () => {
      setSpeaking(false)
      if (duplexRef.current && activeRef.current && !busyRef.current) {
        startListening()
      }
    }
    utter.onerror = () => setSpeaking(false)

    try {
      window.speechSynthesis.speak(utter)
      console.log("[dona-voice]", { result: "tts_speak", chars: text.length, locale })
    } catch (error) {
      setSpeaking(false)
      console.warn("[dona-voice]", {
        result: "tts_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [active, busy, cancelSpeech, locale, speakTarget, startListening, support.tts])

  // Tear down when panel closes
  useEffect(() => {
    if (!active) stopAll()
  }, [active, stopAll])

  // Stop STT while the model streams
  useEffect(() => {
    if (busy && listening) stopRecognition(true)
  }, [busy, listening, stopRecognition])

  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [stopAll])

  return {
    support,
    listening,
    speaking,
    duplex,
    interim,
    setDuplex,
    toggleListen,
    stopAll,
  }
}
