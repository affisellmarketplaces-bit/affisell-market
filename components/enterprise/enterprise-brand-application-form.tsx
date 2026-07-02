"use client"

import { useState, type FormEvent } from "react"
import { Building2, CheckCircle2, Loader2, Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ENTERPRISE_CATALOG_SIZES,
  ENTERPRISE_CATEGORIES,
  ENTERPRISE_COMMERCE_STACKS,
} from "@/lib/crm/enterprise-lead-shared"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

export function EnterpriseBrandApplicationForm({ className }: Props) {
  const t = useTranslations("enterprise.form")
  const locale = useLocale()
  const [brandName, setBrandName] = useState("")
  const [siteUrl, setSiteUrl] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [catalogSize, setCatalogSize] = useState<string>("")
  const [category, setCategory] = useState<string>("")
  const [commerceStack, setCommerceStack] = useState<string>("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!catalogSize || !category || !commerceStack) {
      setError(t("requiredFields"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/enterprise/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          siteUrl: siteUrl.trim() || undefined,
          contactName,
          contactEmail,
          catalogSize,
          category,
          commerceStack,
          message: message.trim() || undefined,
          locale,
          website: "",
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error === "crm_unavailable" ? t("crmError") : t("sendError"))
      }
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("networkError"))
    } finally {
      setBusy(false)
    }
  }

  if (success) {
    return (
      <div
        className={cn(
          "rounded-3xl border border-emerald-200/80 bg-emerald-50/80 p-8 text-center dark:border-emerald-900/50 dark:bg-emerald-950/30",
          className
        )}
      >
        <CheckCircle2 className="mx-auto size-10 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <h2 className="mt-4 text-xl font-bold text-emerald-950 dark:text-emerald-50">{t("successTitle")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-emerald-900/90 dark:text-emerald-100/90">
          {t("successBody")}
        </p>
      </div>
    )
  }

  return (
    <section
      id="apply"
      className={cn(
        "rounded-3xl border border-violet-200/80 bg-white p-6 shadow-lg shadow-violet-500/5 dark:border-violet-900/40 dark:bg-zinc-950 sm:p-8",
        className
      )}
    >
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          <Building2 className="size-5" aria-hidden />
        </span>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            <Sparkles className="size-3.5" aria-hidden />
            {t("eyebrow")}
          </p>
          <h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">{t("title")}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
          aria-hidden
          value=""
          readOnly
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="enterprise-brand">{t("brandName")}</Label>
            <Input
              id="enterprise-brand"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={t("brandNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enterprise-site">{t("website")}</Label>
            <Input
              id="enterprise-site"
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="enterprise-contact">{t("contactName")}</Label>
            <Input
              id="enterprise-contact"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enterprise-email">{t("contactEmail")}</Label>
            <Input
              id="enterprise-email"
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("catalogSize")}</Label>
            <Select value={catalogSize} onValueChange={(value) => setCatalogSize(value ?? "")} required>
              <SelectTrigger>
                <SelectValue placeholder={t("selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {ENTERPRISE_CATALOG_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {t(`catalogSizeOptions.${size}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("category")}</Label>
            <Select value={category} onValueChange={(value) => setCategory(value ?? "")} required>
              <SelectTrigger>
                <SelectValue placeholder={t("selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {ENTERPRISE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`categoryOptions.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("commerceStack")}</Label>
            <Select value={commerceStack} onValueChange={(value) => setCommerceStack(value ?? "")} required>
              <SelectTrigger>
                <SelectValue placeholder={t("selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {ENTERPRISE_COMMERCE_STACKS.map((stack) => (
                  <SelectItem key={stack} value={stack}>
                    {t(`commerceStackOptions.${stack}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="enterprise-message">{t("message")}</Label>
          <textarea
            id="enterprise-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("messagePlaceholder")}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={busy} className="w-full gap-2 bg-violet-600 hover:bg-violet-700 sm:w-auto">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t("submit")}
        </Button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("privacyNote")}</p>
      </form>
    </section>
  )
}
