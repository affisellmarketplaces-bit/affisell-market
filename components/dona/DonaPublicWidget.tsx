"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { AnimatePresence, motion } from "framer-motion"
import { Send, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  DonaAssistantMessage,
  DonaTypingIndicator,
  DonaUserBubble,
  donaGenericError,
  donaMessageText,
  donaResolvedError,
  filterRenderableMessages,
  formatDonaTime,
  resolvePublicLocale,
} from "@/components/dona/dona-chat-ui"
import {
  donaPublicBadge,
  donaPublicPlaceholder,
  donaPublicWelcome,
  resolveDonaPublicAudience,
} from "@/lib/dona/dona-audience"

function shouldHideWidget(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/admin")
}

export function DonaPublicWidget() {
  const pathname = usePathname() ?? ""
  const audience = useMemo(() => resolveDonaPublicAudience(pathname), [pathname])
  const [isOpen, setIsOpen] = useState(false)
  const [locale] = useState(resolvePublicLocale)
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
  const badge = useMemo(() => donaPublicBadge(audience), [audience])
  const visibleMessages = useMemo(() => filterRenderableMessages(messages), [messages])
  const errorText = donaResolvedError(error, locale, donaGenericError(locale))

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
            className="fixed inset-0 z-[100] flex flex-col bg-[#0E0E2C]/95 backdrop-blur-md md:inset-auto md:bottom-24 md:right-6 md:h-[520px] md:w-[380px] md:rounded-2xl md:border md:border-violet-500/20 md:shadow-2xl"
            role="dialog"
            aria-label="Dona — IA de bord Affisell"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#1A1A3D] px-4 py-3 md:rounded-t-2xl">
              <div>
                <p className="text-sm font-semibold text-white">Dona · IA de bord · LIVE</p>
                <span className="mt-0.5 inline-block rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200">
                  {badge} · FR/EN
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Fermer Dona"
              >
                <X className="size-5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm border border-white/10 bg-[#1A1A3D] px-4 py-2.5 text-sm leading-relaxed text-white">
                <span className="mb-1 block text-base" aria-hidden>
                  💜
                </span>
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

              {busy ? <DonaTypingIndicator label="Dona tape..." /> : null}

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
                  aria-label="Envoyer"
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10px] text-white/40">
                Achat protégé · Stripe · 3D Secure · RGPD
              </p>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[99] flex size-14 items-center justify-center rounded-full bg-[#7C3AED] text-2xl shadow-[0_0_20px_rgba(124,58,237,0.5)] transition hover:scale-105 hover:bg-violet-500"
          aria-label="Ouvrir Dona — IA de bord"
        >
          <span aria-hidden>💜</span>
          <span className="absolute right-0 top-0 size-3 animate-pulse rounded-full bg-green-400 ring-2 ring-[#0E0E2C]" />
        </button>
      ) : null}
    </>
  )
}
