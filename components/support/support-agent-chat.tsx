"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Loader2, MessageCircle, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"

import { BentoCard } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"
import { SUPPORT_STARTER_PROMPTS } from "@/lib/support/support-knowledge"
import { cn } from "@/lib/utils"

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
}

export function SupportAgentChat({ className }: { className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")

  const { messages, sendMessage, status, error, stop, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/agent/support" }),
  })

  const busy = status === "submitted" || status === "streaming"

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, status])

  async function sendText(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setInput("")
    clearError()
    await sendMessage({ text: trimmed })
  }

  return (
    <BentoCard
      className={cn(
        "flex min-h-[420px] flex-col overflow-hidden border-violet-200/60 bg-gradient-to-b from-violet-50/40 to-white dark:border-violet-900/40 dark:from-violet-950/20 dark:to-zinc-950",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-violet-200/50 px-4 py-3 dark:border-violet-900/40">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/25">
          <Sparkles className="size-4" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Assistant Support Affisell</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Commandes · livraison · retours · 24/7</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Posez une question — je vous oriente vers la FAQ, vos commandes ou le bon contact.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUPPORT_STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendText(prompt)}
                  className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 transition hover:border-violet-400 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto bg-violet-600 text-white"
                : "mr-auto border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            )}
          >
            {messageText(m.parts)}
          </div>
        ))}

        {busy ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Réflexion…
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Assistant indisponible — consultez la{" "}
            <Link href="/faq" className="font-semibold underline">
              FAQ
            </Link>{" "}
            ou{" "}
            <Link href="/contact" className="font-semibold underline">
              contactez-nous
            </Link>
            .
          </p>
        ) : null}
      </div>

      <form
        className="flex gap-2 border-t border-violet-200/50 p-3 dark:border-violet-900/40"
        onSubmit={(e) => {
          e.preventDefault()
          void sendText(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ex. Où est ma commande ?"
          disabled={busy}
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          aria-label="Votre question support"
        />
        {busy ? (
          <Button type="button" variant="outline" size="sm" onClick={() => stop()}>
            Stop
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!input.trim()} className="gap-1.5">
            <MessageCircle className="size-4" aria-hidden />
            Envoyer
          </Button>
        )}
      </form>
    </BentoCard>
  )
}
