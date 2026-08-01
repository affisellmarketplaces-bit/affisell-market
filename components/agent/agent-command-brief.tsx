"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { AffisellCoachBrief } from "@/components/affisell/affisell-coach-brief"
import { cn } from "@/lib/utils"

type Props = {
  onPickPrompt?: (prompt: string) => void
}

/** First-run shopping agent brief with starter prompts. */
export function AgentCommandBrief({ onPickPrompt }: Props) {
  const t = useTranslations("agent.coach")
  const searchParams = useSearchParams()
  const force = searchParams.get("coach") === "1"
  const suppress =
    searchParams.get("coach") === "0" || searchParams.get("e2eFixtures") === "1"
  const [picked, setPicked] = useState<string | null>(null)
  const prompts = [t("p1"), t("p2"), t("p3")]

  return (
    <AffisellCoachBrief
      surface="buyerAgent"
      force={force}
      suppress={suppress}
      eyebrow={t("eyebrow")}
      title={t("title")}
      body={t("body")}
      cta={t("cta")}
      dismissLabel={t("dismiss")}
      testId="agent-command-brief"
    >
      <ul className="space-y-2">
        {prompts.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => {
                setPicked(prompt)
                onPickPrompt?.(prompt)
              }}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left text-[12px] leading-snug transition",
                picked === prompt
                  ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-50"
                  : "border-white/10 bg-white/[0.04] text-white/80 hover:border-cyan-400/30 hover:bg-white/[0.07]"
              )}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </AffisellCoachBrief>
  )
}
