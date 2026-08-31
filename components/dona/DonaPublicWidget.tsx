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
    }),
    [locale]
  )

  useEffect(() => {
    if (!isOpen) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, status, isOpen, busy, error])

  if (shouldHideWidget(pathname)) {
    return null
  }

  async function sendText(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setInput("")
    clearError()
    await sendMessage({ text: trimmed })
  }

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
                onClick={() => setIsOpen(false)}
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
                void sendText(input)
              }}
            >
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={placeholder}
                  disabled={busy}
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#1A1A3D] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  aria-label={placeholder}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-[0_0_16px_rgba(124,58,237,0.45)] transition hover:bg-violet-500 disabled:opacity-40"
                  aria-label={copy.sendAria}
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-white/40">{copy.trustFooter}</p>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="affisell-dona-fab affisell-dona-fab-portrait fixed z-[99] flex h-[4.75rem] w-[3.35rem] items-stretch justify-center overflow-hidden rounded-2xl border-2 border-violet-300/80 bg-gradient-to-br from-violet-600 via-indigo-700 to-blue-900 shadow-xl ring-2 ring-violet-200/80 transition hover:scale-105 hover:border-violet-200 max-md:active:scale-95"
          aria-label={copy.openFabAria}
        >
          <DonaAvatarImage
            className="size-full object-cover object-top"
            alt="Dona"
            loading="lazy"
            variant="portrait"
          />
          <span
            className="absolute bottom-1 right-1 size-3 animate-pulse rounded-full border-2 border-white bg-green-400"
            aria-hidden
          />
        </button>
      ) : null}
    </>
  )
}
