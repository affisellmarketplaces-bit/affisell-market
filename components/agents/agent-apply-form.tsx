"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, MapPin, ShieldCheck } from "lucide-react"

import { AGENT_CAPABILITY_OPTIONS } from "@/lib/agents/agent-application-shared"
import { cn } from "@/lib/utils"

type Props = {
  /** "fr" | "en" — UI publique bilingue légère */
  locale?: "fr" | "en"
}

const COPY = {
  fr: {
    title: "Rejoindre le réseau d'agents Affisell",
    subtitle:
      "Vous contrôlez la qualité sur place (QC, conformité, photos, relais express) ? Candidatez — validation sous 48 h.",
    displayName: "Nom / structure",
    email: "E-mail professionnel",
    phone: "Téléphone (optionnel)",
    country: "Pays (code ISO, ex. CN, TR)",
    city: "Ville",
    capabilities: "Ce que vous proposez",
    languages: "Langues parlées (séparées par des virgules)",
    leadTime: "Délai moyen de rapport (heures)",
    experience: "Expérience et motivation",
    experiencePlaceholder:
      "Années d'expérience, types de produits, zones couvertes, références…",
    submit: "Envoyer ma candidature",
    submitting: "Envoi…",
    successTitle: "Candidature reçue",
    successBody:
      "Notre équipe examine votre profil sous 48 h. Une fois validé, connectez-vous sur /login/agent (mot de passe via « Mot de passe oublié » la première fois).",
    successDeduped: "Votre candidature est déjà en cours d'examen.",
    errorGeneric: "Impossible d'envoyer — vérifiez les champs et réessayez.",
    errorActive: "Cet e-mail est déjà associé à un agent actif du réseau.",
    required: "Champs obligatoires",
  },
  en: {
    title: "Join the Affisell agent network",
    subtitle:
      "On-the-ground QC, compliance, photo proof or express relay? Apply — review within 48h.",
    displayName: "Name / company",
    email: "Professional email",
    phone: "Phone (optional)",
    country: "Country (ISO code, e.g. CN, TR)",
    city: "City",
    capabilities: "What you offer",
    languages: "Languages spoken (comma-separated)",
    leadTime: "Average report turnaround (hours)",
    experience: "Experience and motivation",
    experiencePlaceholder: "Years of experience, product types, coverage area, references…",
    submit: "Submit application",
    submitting: "Sending…",
    successTitle: "Application received",
    successBody: "Our team reviews your profile within 48h. We'll email you at the address provided.",
    successDeduped: "Your application is already under review.",
    errorGeneric: "Could not submit — check the fields and retry.",
    errorActive: "This email is already linked to an active network agent.",
    required: "Required fields",
  },
} as const

export function AgentApplyForm({ locale = "fr" }: Props) {
  const t = COPY[locale]
  const [displayName, setDisplayName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [country, setCountry] = useState("")
  const [city, setCity] = useState("")
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [languages, setLanguages] = useState("fr, en")
  const [leadTimeHours, setLeadTimeHours] = useState("48")
  const [applicationNote, setApplicationNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<"ok" | "deduped" | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleCap(value: string) {
    setCapabilities((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/agents/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          contactEmail,
          contactPhone: contactPhone || undefined,
          country,
          city,
          capabilities,
          languages: languages.split(/[,;]+/).map((l) => l.trim()),
          leadTimeHours: Number(leadTimeHours),
          applicationNote: applicationNote || undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; deduped?: boolean; error?: string }
      if (!res.ok) {
        setError(data.error === "already_active" ? t.errorActive : t.errorGeneric)
        return
      }
      setDone(data.deduped ? "deduped" : "ok")
    } catch {
      setError(t.errorGeneric)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t.successTitle}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {done === "deduped" ? t.successDeduped : t.successBody}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.displayName} *</span>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.email} *</span>
          <input
            required
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.phone}</span>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.country} *</span>
          <input
            required
            maxLength={2}
            value={country}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder="CN"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.city} *</span>
          <input
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {t.capabilities} *
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {AGENT_CAPABILITY_OPTIONS.map((cap) => (
            <label
              key={cap.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                capabilities.includes(cap.value)
                  ? "border-cyan-500 bg-cyan-50 dark:border-cyan-600 dark:bg-cyan-950/30"
                  : "border-zinc-200 dark:border-zinc-800"
              )}
            >
              <input
                type="checkbox"
                checked={capabilities.includes(cap.value)}
                onChange={() => toggleCap(cap.value)}
                className="rounded"
              />
              {locale === "fr" ? cap.labelFr : cap.labelEn}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.languages} *</span>
        <input
          required
          value={languages}
          onChange={(e) => setLanguages(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.leadTime} *</span>
        <input
          required
          type="number"
          min={4}
          max={168}
          value={leadTimeHours}
          onChange={(e) => setLeadTimeHours(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{t.experience}</span>
        <textarea
          rows={4}
          maxLength={4000}
          value={applicationNote}
          onChange={(e) => setApplicationNote(e.target.value)}
          placeholder={t.experiencePlaceholder}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || capabilities.length === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 sm:w-auto"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {loading ? t.submitting : t.submit}
      </button>
    </form>
  )
}

export function AgentApplyHero({ locale = "fr" }: Props) {
  const t = COPY[locale]
  return (
    <div className="mb-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Agent Network
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
        {t.title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{t.subtitle}</p>
      <ul className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
        <li className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {locale === "fr" ? "7+ pays couverts" : "7+ countries"}
        </li>
        <li>{locale === "fr" ? "Missions rémunérées" : "Paid missions"}</li>
        <li>{locale === "fr" ? "Validation humaine Affisell" : "Human Affisell review"}</li>
      </ul>
    </div>
  )
}
