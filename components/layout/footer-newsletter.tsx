"use client"

import { useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"

export function FooterNewsletter() {
  const t = useTranslations("footer.newsletter")
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    const { default: confetti } = await import("canvas-confetti")
    confetti({
      particleCount: 80,
      spread: 62,
      origin: { y: 0.72 },
      colors: ["#a78bfa", "#818cf8", "#60a5fa", "#f472b6"],
    })

    setSubmitted(true)
    setEmail("")
  }

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">{t("title")}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{t("subtext")}</p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none ring-violet-500/0 backdrop-blur-xl transition focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/25"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 active:scale-[0.99]"
        >
          {t("submit")}
        </button>
      </form>
      <p className="mt-3 text-[11px] leading-relaxed text-white/40">
        {submitted ? t("success") : t("disclaimer")}
      </p>
    </div>
  )
}
