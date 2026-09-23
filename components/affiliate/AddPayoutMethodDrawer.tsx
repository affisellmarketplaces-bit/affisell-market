"use client"

import { Command as Cmd } from "cmdk"
import confetti from "canvas-confetti"
import { AnimatePresence, motion } from "framer-motion"
import { Building2, Check, ChevronLeft, Globe2, Search, Smartphone, Wallet, type LucideIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { Drawer } from "vaul"
import { z } from "zod"

import { rankByFuzzy } from "@/lib/fuzzy-match"
import {
  dialCodeForCountry,
  flagEmoji,
  payoutMethodsForCountry,
  type PayoutContinent,
  PAYOUT_COUNTRY_OPTIONS,
} from "@/lib/payouts/country-coverage"
import { payoutMethodSchema } from "@/lib/payouts/validator"
import { visitorCountryDisplayName } from "@/lib/visitor-country"

type PayoutTypeId = z.infer<typeof payoutMethodSchema>["type"]

const TYPE_ICON: Record<PayoutTypeId, LucideIcon> = {
  BANK: Building2,
  PAYPAL: Wallet,
  WISE: Globe2,
  PAYONEER: Globe2,
  MOBILE_MONEY_WAVE: Smartphone,
  MOBILE_MONEY_ORANGE: Smartphone,
  MOBILE_MONEY_MTN: Smartphone,
}

const TYPE_COLOR: Record<PayoutTypeId, string> = {
  BANK: "bg-blue-500",
  PAYPAL: "bg-[#003087]",
  WISE: "bg-[#00B9FF]",
  PAYONEER: "bg-[#FF4800]",
  MOBILE_MONEY_WAVE: "bg-[#1DC7FF]",
  MOBILE_MONEY_ORANGE: "bg-[#FF7900]",
  MOBILE_MONEY_MTN: "bg-[#FFCC00] text-black",
}

const CONTINENT_ORDER: PayoutContinent[] = ["Europe", "Africa", "Middle East", "Americas", "Asia", "Oceania"]

const bankFormSchema = z.object({
  iban: z.string().min(15, "IBAN"),
  bic: z.string().min(8, "BIC"),
  holderName: z.string().min(2),
})
const emailFormSchema = z.object({ email: z.email() })
const mobileFormSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  fullName: z.string().min(2),
})

type BankFormValues = z.infer<typeof bankFormSchema>
type EmailFormValues = z.infer<typeof emailFormSchema>
type MobileFormValues = z.infer<typeof mobileFormSchema>
type FormValues = BankFormValues & EmailFormValues & MobileFormValues

/** Accent-insensitive search — "senegal" must still find "Sénégal". */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function formSchemaForType(type: PayoutTypeId) {
  if (type === "BANK") return bankFormSchema
  if (type === "PAYPAL" || type === "WISE" || type === "PAYONEER") return emailFormSchema
  return mobileFormSchema
}

function buildApiBody(type: PayoutTypeId, country: string, data: FormValues): Record<string, unknown> {
  const base = { type, country }
  if (type === "BANK") return { ...base, iban: data.iban, bic: data.bic, holderName: data.holderName }
  if (type === "PAYPAL" || type === "WISE" || type === "PAYONEER") return { ...base, email: data.email }
  return { ...base, phone: data.phone, fullName: data.fullName }
}

type Props = {
  onSuccess?: () => void
}

export function AddPayoutMethodDrawer({ onSuccess }: Props) {
  const t = useTranslations("affiliate.payoutMethods")
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [country, setCountry] = useState<string | null>(null)
  const [countryQuery, setCountryQuery] = useState("")
  const [selectedType, setSelectedType] = useState<PayoutTypeId | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    defaultValues: { iban: "", bic: "", holderName: "", email: "", phone: "", fullName: "" },
  })

  const resetDrawer = useCallback(() => {
    setStep(1)
    setCountry(null)
    setCountryQuery("")
    setSelectedType(null)
    setSubmitError(null)
    form.reset()
  }, [form])

  useEffect(() => {
    if (!open) resetDrawer()
  }, [open, resetDrawer])

  useEffect(() => {
    form.clearErrors()
    setSubmitError(null)
  }, [selectedType, form])

  const countryOptions = useMemo(
    () =>
      PAYOUT_COUNTRY_OPTIONS.map((o) => ({
        ...o,
        name: visitorCountryDisplayName(o.code, locale),
      })),
    [locale]
  )

  const rankedCountries = useMemo(
    () =>
      rankByFuzzy(countryOptions, stripDiacritics(countryQuery), (o) =>
        stripDiacritics(`${o.code} ${o.name}`)
      ),
    [countryOptions, countryQuery]
  )

  const groupedCountries = useMemo(() => {
    const groups = new Map<PayoutContinent, typeof rankedCountries>()
    for (const c of rankedCountries) {
      if (c.fuzzyRank <= 0) continue
      const list = groups.get(c.continent) ?? []
      list.push(c)
      groups.set(c.continent, list)
    }
    return CONTINENT_ORDER.map((continent) => ({ continent, countries: groups.get(continent) ?? [] })).filter(
      (g) => g.countries.length > 0
    )
  }, [rankedCountries])

  const rawCodeCandidate =
    /^[a-zA-Z]{2}$/.test(countryQuery.trim()) ? countryQuery.trim().toUpperCase() : null
  const showRawCodeOption =
    rawCodeCandidate !== null && !countryOptions.some((o) => o.code === rawCodeCandidate)

  const availableTypes = useMemo(() => (country ? payoutMethodsForCountry(country) : []), [country])

  function pickCountry(code: string) {
    setCountry(code)
    setStep(2)
    setSelectedType(null)
  }

  function pickType(type: PayoutTypeId) {
    setSelectedType(type)
    if (country && (type === "MOBILE_MONEY_WAVE" || type === "MOBILE_MONEY_ORANGE" || type === "MOBILE_MONEY_MTN")) {
      const dial = dialCodeForCountry(country)
      if (dial && !form.getValues("phone")) form.setValue("phone", `${dial} `)
    }
    setStep(3)
  }

  async function onSubmit(rawData: FormValues) {
    if (!selectedType || !country) return
    setSubmitting(true)
    setSubmitError(null)
    form.clearErrors()

    // Humans type phone numbers with spaces (and our own dial-code prefill adds one) — normalize
    // before validating so "+221 77 123 45 67" isn't rejected for containing spaces.
    const data: FormValues = { ...rawData, phone: rawData.phone.replace(/[\s.-]+/g, "") }

    const fieldParsed = formSchemaForType(selectedType).safeParse(data)
    if (!fieldParsed.success) {
      for (const issue of fieldParsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") form.setError(field as keyof FormValues, { message: issue.message })
      }
      setSubmitting(false)
      return
    }

    try {
      const body = buildApiBody(selectedType, country, data)
      const res = await fetch("/api/affiliate/payout-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const errBody = payload as { error?: string | { message?: string }[] } | null
        const message =
          typeof errBody?.error === "string"
            ? errBody.error
            : Array.isArray(errBody?.error)
              ? errBody.error.map((i) => i.message ?? t("genericError")).join(", ")
              : t("genericError")
        throw new Error(message)
      }
      void confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
      setOpen(false)
      onSuccess?.()
      router.refresh()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("genericError"))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClassName =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none ring-violet-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"

  const selectedCountryLabel = country ? `${flagEmoji(country)} ${visitorCountryDisplayName(country, locale)}` : ""

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 font-medium text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
        >
          + {t("addButton")}
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92vh] flex-col rounded-t-3xl bg-white dark:bg-zinc-950">
          <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-zinc-700" />
          <div className="overflow-y-auto p-6">
            <Drawer.Title className="text-2xl font-bold text-zinc-900 dark:text-white">
              {t("title")}
            </Drawer.Title>
            <Drawer.Description className="mt-1 text-gray-500 dark:text-zinc-400">
              {t("subtitle")}
            </Drawer.Description>

            {/* Step indicator */}
            <div className="mt-4 flex items-center gap-1.5" aria-hidden>
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    n <= step ? "bg-violet-600" : "bg-zinc-200 dark:bg-zinc-800"
                  }`}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="mt-6"
                >
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t("stepCountry")}
                  </p>
                  <Cmd
                    className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
                    shouldFilter={false}
                  >
                    <div className="flex items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
                      <Search className="size-4 shrink-0 text-zinc-400" aria-hidden />
                      <Cmd.Input
                        value={countryQuery}
                        onValueChange={setCountryQuery}
                        placeholder={t("countrySearchPlaceholder")}
                        className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-100"
                        autoFocus
                      />
                    </div>
                    <Cmd.List className="max-h-[46vh] overflow-y-auto p-2">
                      {groupedCountries.map(({ continent, countries }) => (
                        <Cmd.Group
                          key={continent}
                          heading={t(`continent.${continent}`)}
                          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-400"
                        >
                          {countries.map((c) => (
                            <Cmd.Item
                              key={c.code}
                              value={c.code}
                              onSelect={() => pickCountry(c.code)}
                              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-zinc-800 aria-selected:bg-violet-50 dark:text-zinc-100 dark:aria-selected:bg-violet-950/40"
                            >
                              <span className="text-lg">{flagEmoji(c.code)}</span>
                              <span className="min-w-0 flex-1 truncate">{c.name}</span>
                              <span className="text-xs text-zinc-400">{c.code}</span>
                            </Cmd.Item>
                          ))}
                        </Cmd.Group>
                      ))}
                      {showRawCodeOption ? (
                        <Cmd.Item
                          value={rawCodeCandidate!}
                          onSelect={() => pickCountry(rawCodeCandidate!)}
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-violet-700 aria-selected:bg-violet-50 dark:text-violet-300 dark:aria-selected:bg-violet-950/40"
                        >
                          <span className="text-lg">{flagEmoji(rawCodeCandidate!)}</span>
                          <span>{t("useCodeAsIs", { code: rawCodeCandidate! })}</span>
                        </Cmd.Item>
                      ) : null}
                      <Cmd.Empty className="px-2.5 py-6 text-center text-sm text-zinc-400">
                        {t("countryNotFound")}
                      </Cmd.Empty>
                    </Cmd.List>
                  </Cmd>
                </motion.div>
              ) : step === 2 ? (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="mt-6"
                >
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    {selectedCountryLabel}
                  </button>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t("stepMethod")}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {availableTypes.map((type) => {
                      const Icon = TYPE_ICON[type]
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => pickType(type)}
                          className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-gray-300 dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <div
                            className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-white ${TYPE_COLOR[type]}`}
                          >
                            <Icon className="h-5 w-5" aria-hidden />
                          </div>
                          <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                            {t(`type.${type}.label`)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-zinc-400">
                            {t(`type.${type}.sub`)}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="mt-6 space-y-4"
                >
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    {selectedType ? t(`type.${selectedType}.label`) : ""} · {selectedCountryLabel}
                  </button>

                  {selectedType === "BANK" ? (
                    <>
                      <input
                        {...form.register("iban")}
                        placeholder={t("field.ibanPlaceholder")}
                        className={inputClassName}
                      />
                      {form.formState.errors.iban ? (
                        <p className="text-xs text-red-600">{t("field.ibanRequired")}</p>
                      ) : null}
                      <input
                        {...form.register("bic")}
                        placeholder={t("field.bicPlaceholder")}
                        className={inputClassName}
                      />
                      {form.formState.errors.bic ? (
                        <p className="text-xs text-red-600">{t("field.bicRequired")}</p>
                      ) : null}
                      <input
                        {...form.register("holderName")}
                        placeholder={t("field.holderNamePlaceholder")}
                        className={inputClassName}
                      />
                      {form.formState.errors.holderName ? (
                        <p className="text-xs text-red-600">{t("field.holderNameRequired")}</p>
                      ) : null}
                    </>
                  ) : null}

                  {selectedType === "PAYPAL" || selectedType === "WISE" || selectedType === "PAYONEER" ? (
                    <>
                      <input
                        {...form.register("email")}
                        type="email"
                        placeholder={t("field.emailPlaceholder")}
                        className={inputClassName}
                      />
                      {form.formState.errors.email ? (
                        <p className="text-xs text-red-600">{t("field.emailInvalid")}</p>
                      ) : null}
                    </>
                  ) : null}

                  {selectedType?.startsWith("MOBILE_MONEY") ? (
                    <>
                      <input
                        {...form.register("phone")}
                        placeholder={dialCodeForCountry(country ?? "") ?? "+221 77 123 45 67"}
                        className={inputClassName}
                      />
                      {form.formState.errors.phone ? (
                        <p className="text-xs text-red-600">{t("field.phoneInvalid")}</p>
                      ) : null}
                      <input
                        {...form.register("fullName")}
                        placeholder={t("field.fullNamePlaceholder")}
                        className={inputClassName}
                      />
                      {form.formState.errors.fullName ? (
                        <p className="text-xs text-red-600">{t("field.fullNameRequired")}</p>
                      ) : null}
                    </>
                  ) : null}

                  {submitError ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                      {submitError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-gray-900 py-3.5 font-medium text-white hover:bg-black disabled:opacity-60 dark:bg-violet-600 dark:hover:bg-violet-700"
                  >
                    {submitting ? t("submitting") : t("submit")}
                  </button>
                  <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-zinc-400">
                    <Check className="size-3" aria-hidden />
                    {t("encryptionNote")}
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
