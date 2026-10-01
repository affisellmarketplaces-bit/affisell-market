"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { AnimatePresence, motion } from "framer-motion"
import { Send, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import { useAppLocale } from "@/hooks/use-app-locale"

import {
  DonaAssistantMessage,
  DonaTypingIndicator,
  DonaUserBubble,
  donaGenericError,
  donaMessageText,
  donaResolvedError,
  filterRenderableMessages,
  formatDonaTime,
} from "@/components/dona/dona-chat-ui"
import { DonaAvatarImage } from "@/components/dona/dona-avatar-image"
import { DonaFabOrb } from "@/components/dona/dona-fab-orb"
import { DonaVoiceControls, DonaVoiceLiveStage } from "@/components/dona/dona-voice-live"
import { useDonaVoiceSession } from "@/components/dona/use-dona-voice"
import {
  donaPublicBadge,
  donaPublicPlaceholder,
  donaPublicWelcome,
  resolveDonaPublicAudience,
} from "@/lib/dona/dona-audience"
import { tMessage } from "@/lib/i18n-pick-message"

function shouldHideWidget(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/admin")
}

export function DonaPublicWidget() {
  const pathname = usePathname() ?? ""
  const locale = useAppLocale()
  const audience = useMemo(() => resolveDonaPublicAudience(pathname), [pathname])
  const [isOpen, setIsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")
  const voiceModeRef = useRef(false)

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/dona/chat-public",
      prepareSendMessagesRequest: ({ body, messages: msgs, id, trigger, messageId }) => ({
        body: {
          ...(typeof body === "object" && body !== null && !Array.isArray(body) ? body : {}),
          id,
          messages: msgs,
          trigger,
          messageId,
          audience,
          locale,
          voiceMode: voiceModeRef.current,
        },
      }),
    }),
    onError: (err) => {
      console.error("[dona-public-widget]", err)
    },
  })

  const busy = status === "submitted" || status === "streaming"
  const placeholder = useMemo(() => donaPublicPlaceholder(audience, locale), [audience, locale])
  const welcome = useMemo(() => donaPublicWelcome(audience, locale), [audience, locale])
  const badge = useMemo(() => donaPublicBadge(audience, locale), [audience, locale])
  const visibleMessages = useMemo(() => filterRenderableMessages(messages), [messages])
  const errorText = donaResolvedError(error, locale, donaGenericError(locale))

  const copy = useMemo(
    () => ({
      dialogLabel: tMessage(locale, "donaWidget.public.dialogLabel"),
      headerTitle: tMessage(locale, "donaWidget.public.headerTitle"),
      typingLabel: tMessage(locale, "donaWidget.public.typing"),
      sendAria: tMessage(locale, "donaWidget.public.sendAria"),
      closeAria: tMessage(locale, "donaWidget.public.closeAria"),
      openFabAria: tMessage(locale, "donaWidget.public.openFabAria"),
      trustFooter: tMessage(locale, "donaWidget.public.trustFooter"),
      localeBadge: tMessage(locale, "donaWidget.public.localeBadge"),
      voiceMic: tMessage(locale, "donaWidget.voice.micAria"),
      voiceLive: tMessage(locale, "donaWidget.voice.liveAria"),
      voiceStop: tMessage(locale, "donaWidget.voice.stopAria"),
      voiceListening: tMessage(locale, "donaWidget.voice.listening"),
      voiceTranscribing: tMessage(locale, "donaWidget.voice.transcribing"),
      voiceSpeaking: tMessage(locale, "donaWidget.voice.speaking"),
      voiceLiveOn: tMessage(locale, "donaWidget.voice.liveOn"),
      voiceHangup: tMessage(locale, "donaWidget.voice.hangupAria"),
      voiceHint: tMessage(locale, "donaWidget.voice.hint"),
      voicePermission: tMessage(locale, "donaWidget.voice.permissionDenied"),
      voiceUnsupported: tMessage(locale, "donaWidget.voice.unsupported"),
      voiceEmpty: tMessage(locale, "donaWidget.voice.empty"),
      voiceTranscribeErr: tMessage(locale, "donaWidget.voice.transcribeError"),
    }),
    [locale]
  )

  const lastAssistant = useMemo(() => {
    const last = [...visibleMessages].reverse().find((m) => m.role === "assistant")
    return {
      id: last?.id ?? null,
      text: last ? donaMessageText(last) : "",
    }
  }, [visibleMessages])

  async function sendText(text: string, viaVoice = false) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setInput("")
    clearError()
    voiceModeRef.current = viaVoice
    await sendMessage({ text: trimmed })
  }

  const voice = useDonaVoiceSession({
    locale,
    open: isOpen,
    busy,
    lastAssistantId: lastAssistant.id,
    lastAssistantText: lastAssistant.text,
    welcomeText: welcome,
    hasUserTurn: visibleMessages.some((m) => m.role === "user"),
    onSend: (text) => sendText(text, true),
  })

  useEffect(() => {
    if (voice.live) voiceModeRef.current = true
  }, [voice.live])

  useEffect(() => {
    if (!isOpen) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, status, isOpen, busy, error])

  if (shouldHideWidget(pathname)) {
    return null
  }

  const voiceError =
    voice.errorKey === "permission"
      ? copy.voicePermission
      : voice.errorKey === "unsupported"
        ? copy.voiceUnsupported
        : voice.errorKey === "empty"
          ? copy.voiceEmpty
          : voice.errorKey === "transcribe"
            ? copy.voiceTranscribeErr
            : null

  return (
    <>
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="dona-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="affisell-dona-panel-mobile fixed inset-0 z-[100] flex flex-col bg-[#0E0E2C]/95 backdrop-blur-md md:inset-auto md:bottom-24 md:right-6 md:h-[520px] md:w-[380px] md:rounded-2xl md:border md:border-violet-500/20 md:shadow-2xl"
            role="dialog"
            aria-label={copy.dialogLabel}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#1A1A3D] px-4 py-3 md:rounded-t-2xl">
              <div className="flex min-w-0 items-center gap-2">
                <DonaAvatarImage
                  className="h-14 w-10 shrink-0 rounded-xl object-cover object-top ring-1 ring-violet-400/40 shadow-[0_0_12px_rgba(124,58,237,0.25)]"
                  alt="Dona"
                  loading="eager"
                  variant="portrait"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{copy.headerTitle}</p>
                  <span className="mt-0.5 inline-block rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200">
                    {badge} · {copy.localeBadge}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  voice.stopAll()
                  setIsOpen(false)
                }}
                className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label={copy.closeAria}
              >
                <X className="size-5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border border-white/10 bg-[#1A1A3D] px-4 py-2.5 text-sm leading-relaxed text-white">
                <DonaAvatarImage
                  className="mb-2 h-11 w-8 rounded-lg object-cover object-top ring-1 ring-violet-400/30"
                  alt=""
                  loading="lazy"
                  variant="portrait"
                />
                {welcome}
                <span className="mt-1 block text-[10px] text-white/40">{formatDonaTime(new Date())}</span>
              </div>

              {visibleMessages.map((m) =>
                m.role === "user" ? (
                  <DonaUserBubble key={m.id} text={donaMessageText(m)} />
                ) : (
                  <DonaAssistantMessage key={m.id} message={m} />
                )
              )}

              {busy ? <DonaTypingIndicator label={copy.typingLabel} /> : null}

              {error ? (
                <p className="mr-auto max-w-[85%] rounded-2xl border border-amber-500/30 bg-amber-950/40 px-4 py-2 text-xs text-amber-100">
                  {errorText}
                </p>
              ) : null}
            </div>

            <form
              className="shrink-0 border-t border-white/10 p-3"
              onSubmit={(e) => {
                e.preventDefault()
                void sendText(input, voice.live)
              }}
            >
              {voice.live ? (
                <DonaVoiceLiveStage
                  phase={voice.phase}
                  level={voice.level}
                  interim={voice.interim}
                  onHangup={voice.stopAll}
                  copy={{
                    listening: copy.voiceListening,
                    transcribing: copy.voiceTranscribing,
                    speaking: copy.voiceSpeaking,
                    liveOn: copy.voiceLiveOn,
                    hangupAria: copy.voiceHangup,
                  }}
                />
              ) : null}
              {voiceError ? (
                <p className="mb-2 text-center text-[11px] text-amber-200">{voiceError}</p>
              ) : null}
              <div className="flex gap-2">
                <DonaVoiceControls
                  live={voice.live}
                  phase={voice.phase}
                  supported={voice.supported}
                  busy={busy}
                  micAria={copy.voiceMic}
                  liveAria={copy.voiceLive}
                  stopAria={copy.voiceStop}
                  onMicDown={voice.startHold}
                  onMicUp={voice.stopHold}
                  onToggleLive={voice.toggleLive}
                />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={voice.live ? copy.voiceListening : placeholder}
                  disabled={busy || voice.live}
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#1A1A3D] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  aria-label={placeholder}
                />
                <button
                  type="submit"
                  disabled={busy || voice.live || !input.trim()}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-[0_0_16px_rgba(124,58,237,0.45)] transition hover:bg-violet-500 disabled:opacity-40"
                  aria-label={copy.sendAria}
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-white/40">
                {voice.supported ? copy.voiceHint : copy.trustFooter}
              </p>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isOpen ? (
        <DonaFabOrb onClick={() => setIsOpen(true)} ariaLabel={copy.openFabAria} alt="Dona" />
      ) : null}
    </>
  )
}
