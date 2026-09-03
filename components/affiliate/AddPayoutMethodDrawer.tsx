"use client"

import confetti from "canvas-confetti"
import { AnimatePresence, motion } from "framer-motion"
import { Building2, Globe, Smartphone, Wallet, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Drawer } from "vaul"
import { z } from "zod"

import { payoutMethodSchema } from "@/lib/payouts/validator"

type PayoutTypeId = z.infer<typeof payoutMethodSchema>["type"]

type TypeOption = {
  id: PayoutTypeId
  label: string
  sub: string
  icon: LucideIcon
  color: string
}

const TYPES: TypeOption[] = [
  { id: "BANK", label: "Virement", sub: "IBAN • 2-3j", icon: Building2, color: "bg-blue-500" },
  { id: "PAYPAL", label: "PayPal", sub: "Instantané", icon: Wallet, color: "bg-[#003087]" },
  { id: "WISE", label: "Wise", sub: "International cheap", icon: Globe, color: "bg-[#00B9FF]" },
  {
    id: "MOBILE_MONEY_WAVE",
    label: "Wave",
    sub: "Sénégal / CI",
    icon: Smartphone,
    color: "bg-[#1DC7FF]",
  },
  {
    id: "MOBILE_MONEY_ORANGE",
    label: "Orange Money",
    sub: "Afrique",
    icon: Smartphone,
    color: "bg-[#FF7900]",
  },
  {
    id: "MOBILE_MONEY_MTN",
    label: "MTN MoMo",
    sub: "Afrique",
    icon: Smartphone,
    color: "bg-[#FFCC00] text-black",
  },
]

const bankFormSchema = z.object({
  iban: z.string().min(15, "IBAN requis (min. 15 caractères)"),
  bic: z.string().min(8, "BIC requis (min. 8 caractères)"),
  holderName: z.string().min(2, "Nom du titulaire requis"),
})

const emailFormSchema = z.object({
  email: z.email("Email invalide"),
})

const mobileFormSchema = z.object({
  phone: z
    .string()
    .regex(/^(\+221|\+225|\+33)/, "Téléphone : +221, +225 ou +33"),
  fullName: z.string().min(2, "Nom complet requis"),
})

type BankFormValues = z.infer<typeof bankFormSchema>
type EmailFormValues = z.infer<typeof emailFormSchema>
type MobileFormValues = z.infer<typeof mobileFormSchema>
type FormValues = BankFormValues & EmailFormValues & MobileFormValues

function detectCountryFromLocale(): string {
  if (typeof navigator === "undefined") return "FR"
  const lang = navigator.language.toLowerCase()
  if (lang.includes("sn")) return "SN"
  if (lang.includes("ci")) return "CI"
  if (lang.startsWith("de")) return "DE"
  if (lang.startsWith("be")) return "BE"
  return "FR"
}

function formSchemaForType(type: PayoutTypeId) {
  if (type === "BANK") return bankFormSchema
  if (type === "PAYPAL" || type === "WISE" || type === "PAYONEER") return emailFormSchema
  return mobileFormSchema
}

function buildApiBody(type: PayoutTypeId, country: string, data: FormValues): Record<string, unknown> {
  const base = { type, country }
  if (type === "BANK") {
    return { ...base, iban: data.iban, bic: data.bic, holderName: data.holderName }
  }
  if (type === "PAYPAL" || type === "WISE" || type === "PAYONEER") {
    return { ...base, email: data.email }
  }
  return { ...base, phone: data.phone, fullName: data.fullName }
}

type Props = {
  onSuccess?: () => void
}

export function AddPayoutMethodDrawer({ onSuccess }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedType, setSelectedType] = useState<PayoutTypeId>("BANK")
  const [country, setCountry] = useState("FR")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    defaultValues: {
      iban: "",
      bic: "",
      holderName: "",
      email: "",
      phone: "",
      fullName: "",
    },
  })

  const resetDrawer = useCallback(() => {
    setStep(1)
    setSelectedType("BANK")
    setCountry(detectCountryFromLocale())
    setSubmitError(null)
    form.reset()
  }, [form])

  useEffect(() => {
    if (open) {
      setCountry(detectCountryFromLocale())
    } else {
      resetDrawer()
    }
  }, [open, resetDrawer])

  useEffect(() => {
    form.clearErrors()
    setSubmitError(null)
  }, [selectedType, form])

  async function onSubmit(data: FormValues) {
    setSubmitting(true)
    setSubmitError(null)
    form.clearErrors()

    const fieldParsed = formSchemaForType(selectedType).safeParse(data)
    if (!fieldParsed.success) {
      for (const issue of fieldParsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string") {
          form.setError(field as keyof FormValues, { message: issue.message })
        }
      }
      setSubmitting(false)
      return
    }

    try {
      const body = buildApiBody(selectedType, country, data)
      payoutMethodSchema.parse(body)

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
              ? errBody.error.map((i) => i.message ?? "Erreur").join(", ")
              : "Erreur lors de l'ajout"
        throw new Error(message)
      }

      void confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
      setOpen(false)
      onSuccess?.()
      router.refresh()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Erreur")
    } finally {
      setSubmitting(false)
    }
  }

  function selectType(type: PayoutTypeId) {
    setSelectedType(type)
    setStep(2)
  }

  const inputClassName =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none ring-violet-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 font-medium text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
        >
          + Ajouter une méthode
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92vh] flex-col rounded-t-3xl bg-white dark:bg-zinc-950">
          <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-zinc-700" />
          <div className="overflow-y-auto p-6">
            <Drawer.Title className="text-2xl font-bold text-zinc-900 dark:text-white">
              Ajouter une méthode de paiement
            </Drawer.Title>
            <Drawer.Description className="mt-1 text-gray-500 dark:text-zinc-400">
              Chiffré AES-256 • Jamais stocké en clair
            </Drawer.Description>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="mt-6"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {TYPES.map((t) => {
                      const Icon = t.icon
                      const active = selectedType === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectType(t.id)}
                          className={`rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
                            active
                              ? "border-violet-200 bg-violet-50 ring-2 ring-violet-500 dark:border-violet-800 dark:bg-violet-950/30"
                              : "border-gray-200 bg-white hover:border-gray-300 dark:border-zinc-800 dark:bg-zinc-900"
                          }`}
                        >
                          <div
                            className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-white ${t.color}`}
                          >
                            <Icon className="h-5 w-5" aria-hidden />
                          </div>
                          <div className="font-semibold text-zinc-900 dark:text-zinc-50">{t.label}</div>
                          <div className="text-xs text-gray-500 dark:text-zinc-400">{t.sub}</div>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="mt-6 space-y-4"
                >
                  <div className="flex gap-2">
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="FR">🇫🇷 FR</option>
                      <option value="BE">🇧🇪 BE</option>
                      <option value="DE">🇩🇪 DE</option>
                      <option value="SN">🇸🇳 SN</option>
                      <option value="CI">🇨🇮 CI</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-700"
                    >
                      ← Types
                    </button>
                  </div>

                  {selectedType === "BANK" ? (
                    <>
                      <input
                        {...form.register("iban")}
                        placeholder="IBAN — FR76 3000 6000 0112..."
                        className={inputClassName}
                      />
                      {form.formState.errors.iban ? (
                        <p className="text-xs text-red-600">{form.formState.errors.iban.message}</p>
                      ) : null}
                      <input
                        {...form.register("bic")}
                        placeholder="BIC — AGRIFRPP"
                        className={inputClassName}
                      />
                      {form.formState.errors.bic ? (
                        <p className="text-xs text-red-600">{form.formState.errors.bic.message}</p>
                      ) : null}
                      <input
                        {...form.register("holderName")}
                        placeholder="Nom du titulaire"
                        className={inputClassName}
                      />
                      {form.formState.errors.holderName ? (
                        <p className="text-xs text-red-600">{form.formState.errors.holderName.message}</p>
                      ) : null}
                    </>
                  ) : null}

                  {selectedType === "PAYPAL" || selectedType === "WISE" ? (
                    <>
                      <input
                        {...form.register("email")}
                        type="email"
                        placeholder="email@exemple.com"
                        className={inputClassName}
                      />
                      {form.formState.errors.email ? (
                        <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
                      ) : null}
                    </>
                  ) : null}

                  {selectedType.startsWith("MOBILE_MONEY") ? (
                    <>
                      <input
                        {...form.register("phone")}
                        placeholder="+221 77 123 45 67"
                        className={inputClassName}
                      />
                      {form.formState.errors.phone ? (
                        <p className="text-xs text-red-600">{form.formState.errors.phone.message}</p>
                      ) : null}
                      <input
                        {...form.register("fullName")}
                        placeholder="Nom complet"
                        className={inputClassName}
                      />
                      {form.formState.errors.fullName ? (
                        <p className="text-xs text-red-600">{form.formState.errors.fullName.message}</p>
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
                    {submitting ? "Chiffrement…" : "Ajouter & chiffrer 🔒"}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
