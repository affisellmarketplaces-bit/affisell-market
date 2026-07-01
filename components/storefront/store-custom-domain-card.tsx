"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Globe, Loader2, Shield } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { vercelDomainStatusMessageKey } from "@/lib/vercel-domain-status-label"
import { cn } from "@/lib/utils"

type DomainStatusPayload = {
  customDomain?: string | null
  domainVerified?: boolean
  vercelDomainStatus?: string | null
  vercelDomainError?: string | null
  vercelAutoProvision?: boolean
  publicStoreUrl?: string
  dnsTarget?: string
}

type Props = {
  className?: string
  /** Compact layout for embedding in Brand Studio */
  variant?: "default" | "studio"
}

export function StoreCustomDomainCard({ className, variant = "default" }: Props) {
  const t = useTranslations("storefront.domain")
  const [dnsTarget, setDnsTarget] = useState("cname.affisell.com")
  const [customDomain, setCustomDomain] = useState("")
  const [domainVerified, setDomainVerified] = useState(false)
  const [vercelStatus, setVercelStatus] = useState<string | null>(null)
  const [vercelError, setVercelError] = useState<string | null>(null)
  const [publicStoreUrl, setPublicStoreUrl] = useState<string | null>(null)
  const [vercelAuto, setVercelAuto] = useState(false)

  const [saving, setSaving] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/store/domain-status", { credentials: "include", cache: "no-store" })
    if (!res.ok) return
    const json = (await res.json()) as DomainStatusPayload
    if (json.customDomain != null) setCustomDomain(json.customDomain ?? "")
    if (json.domainVerified != null) setDomainVerified(json.domainVerified)
    setVercelStatus(json.vercelDomainStatus ?? null)
    setVercelError(json.vercelDomainError ?? null)
    if (json.publicStoreUrl) setPublicStoreUrl(json.publicStoreUrl)
    if (json.vercelAutoProvision != null) setVercelAuto(json.vercelAutoProvision)
  }, [])

  const hydrate = useCallback(async () => {
    try {
      const [meRes] = await Promise.all([
        fetch("/api/store/me", { credentials: "include", cache: "no-store" }),
        refreshStatus(),
      ])
      const meJson = (await meRes.json()) as { dnsTarget?: string; store?: { customDomain?: string | null; domainVerified?: boolean } }
      if (meJson.dnsTarget) setDnsTarget(meJson.dnsTarget)
      const st = meJson.store
      if (st) {
        setCustomDomain(st.customDomain ?? "")
        setDomainVerified(st.domainVerified ?? false)
      }
    } catch {
      /* ignore */
    }
  }, [refreshStatus])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!domainVerified || vercelStatus === "active" || vercelStatus === "skipped") return
    const id = window.setInterval(() => void refreshStatus(), 12_000)
    return () => window.clearInterval(id)
  }, [domainVerified, vercelStatus, refreshStatus])

  async function saveDomain() {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const fd = new FormData()
      const me = await fetch("/api/store/me", { credentials: "include" })
      const meJson = (await me.json()) as { store?: { name?: string } }
      const storeName = meJson.store?.name?.trim()
      if (!storeName) {
        throw new Error(t("nameRequired"))
      }
      fd.set("name", storeName)
      fd.set("customDomain", customDomain.trim())

      const res = await fetch("/api/store/update", { method: "POST", body: fd, credentials: "include" })
      const json = (await res.json()) as { error?: string; store?: { customDomain?: string | null; domainVerified?: boolean } }
      if (!res.ok) throw new Error(json.error ?? t("saveFailed"))
      if (json.store) {
        setCustomDomain(json.store.customDomain ?? "")
        setDomainVerified(json.store.domainVerified ?? false)
      }
      setMessage(t("domainSaved"))
      await refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function verifyDomain() {
    setVerifyBusy(true)
    setError(null)
    setMessage(null)
    try {
      await saveDomain()
      const res = await fetch("/api/store/verify-domain", {
        method: "POST",
        credentials: "include",
      })
      const json = (await res.json()) as {
        verified?: boolean
        message?: string
        error?: string
        vercel?: { status?: string; message?: string }
      }
      if (json.error) throw new Error(json.error)
      if (json.verified) {
        setDomainVerified(true)
        setMessage(json.message ?? t("domainVerified"))
        if (json.vercel?.status) setVercelStatus(json.vercel.status)
      } else {
        setMessage(json.message ?? t("notVerifiedYet"))
      }
      await refreshStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("verificationFailed"))
    } finally {
      setVerifyBusy(false)
    }
  }

  const isStudio = variant === "studio"
  const exampleHost = t("exampleHost")

  return (
    <section
      className={cn(
        isStudio
          ? "rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-white to-fuchsia-50/40 p-6 dark:border-violet-900/50 dark:from-violet-950/30 dark:via-zinc-950 dark:to-fuchsia-950/20"
          : "rounded-lg border border-gray-200 bg-gray-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-700 dark:text-violet-300">
          <Globe className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-50">{t("title")}</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
            {t("description", { example: exampleHost })}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <label htmlFor="custom-domain-input" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {t("domainName")}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="custom-domain-input"
            value={customDomain}
            onChange={(e) => {
              setCustomDomain(e.target.value)
              setDomainVerified(false)
            }}
            placeholder={t("placeholder")}
            className="flex-1"
          />
          <Button type="button" variant="outline" disabled={saving || verifyBusy} onClick={() => void saveDomain()}>
            {saving ? t("saving") : t("saveDomain")}
          </Button>
        </div>
      </div>

      {customDomain.trim() && !domainVerified ? (
        <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="font-medium text-amber-950 dark:text-amber-100">{t("dnsTitle")}</p>
          <code className="mt-2 block break-all rounded-lg bg-white/90 px-3 py-2 text-xs dark:bg-zinc-950">
            {customDomain.trim()} → {dnsTarget}
          </code>
          <Button
            type="button"
            className="mt-3"
            disabled={verifyBusy || saving}
            onClick={() => void verifyDomain()}
          >
            {verifyBusy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                {t("checkingDns")}
              </>
            ) : (
              <>
                <Shield className="mr-2 size-4" aria-hidden />
                {t("verifySsl")}
              </>
            )}
          </Button>
        </div>
      ) : null}

      {domainVerified ? (
        <div className="mt-4 space-y-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {t("dnsVerified")}
          </p>
          {publicStoreUrl ? (
            <a
              href={publicStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block break-all text-sm font-semibold text-emerald-800 underline underline-offset-2 dark:text-emerald-200"
            >
              {publicStoreUrl}
            </a>
          ) : null}
          <p className="text-xs text-emerald-800/90 dark:text-emerald-200/80">
            {t(vercelDomainStatusMessageKey(vercelStatus))}
            {vercelAuto ? t("vercelAuto") : t("vercelManual")}
          </p>
          {vercelError ? (
            <p className="text-xs text-rose-700 dark:text-rose-300">{vercelError}</p>
          ) : null}
          {vercelStatus !== "active" && vercelStatus !== "skipped" ? (
            <p className="text-xs text-emerald-800/80 dark:text-emerald-200/70">{t("cronHint")}</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}
    </section>
  )
}
