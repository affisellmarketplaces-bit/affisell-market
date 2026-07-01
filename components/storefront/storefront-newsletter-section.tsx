"use client"

import { useState, type FormEvent } from "react"
import { Mail } from "lucide-react"
import { useTranslations } from "next-intl"

import { sectionCopyString, type HomepageSectionContent } from "@/lib/storefront-sections-shared"
import { cn } from "@/lib/utils"

type Props = {
  content?: HomepageSectionContent
  accent?: string
  className?: string
}

export function StorefrontNewsletterSection({ content, accent, className }: Props) {
  const t = useTranslations("storefront.homeSections")
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const title = sectionCopyString(content, "title", t("newsletterTitle"))
  const body = sectionCopyString(content, "body", t("newsletterBody"))
  const placeholder = sectionCopyString(content, "placeholder", t("newsletterPlaceholder"))
  const buttonLabel = sectionCopyString(content, "buttonLabel", t("newsletterButton"))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    console.log("[storefront-newsletter]", { email: trimmed, result: "subscribed" })

    try {
      const { default: confetti } = await import("canvas-confetti")
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.75 },
        colors: ["#a78bfa", "#818cf8", "#7c3aed"],
      })
    } catch {
      // confetti optional
    }

    setSubmitted(true)
    setEmail("")
  }

  return (
    <section
      className={cn(
        "border-y border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/50 dark:border-violet-900/40 dark:from-violet-950/30 dark:via-zinc-950 dark:to-indigo-950/20",
        className
      )}
    >
      <div className="mx-auto max-w-xl px-4 py-10 text-center sm:px-6">
        <div
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
          style={accent ? { color: accent, backgroundColor: `${accent}18` } : undefined}
        >
          <Mail className="size-5" aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none ring-violet-500/0 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 sm:max-w-xs"
          />
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            {buttonLabel}
          </button>
        </form>
        <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-500">
          {submitted ? t("newsletterSuccess") : t("newsletterDisclaimer")}
        </p>
      </div>
    </section>
  )
}
