"use client"

import Image from "next/image"
import Link from "next/link"
import type { FormEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseSupplierLogisticsAddress, type SupplierLogisticsAddress } from "@/lib/supplier-logistics-address"

type StoreRow = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  aiAvatarUrl: string | null
  bannerUrl: string | null
  description: string | null
  customDomain: string | null
  domainVerified: boolean
  shipFromAddress?: unknown
  returnAddress?: unknown
}

type AddrForm = {
  company: string
  line1: string
  line2: string
  city: string
  region: string
  postalCode: string
  countryCode: string
  phone: string
}

const emptyAddr = (): AddrForm => ({
  company: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "",
  phone: "",
})

function addrToForm(a: SupplierLogisticsAddress): AddrForm {
  return {
    company: a.company ?? "",
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    region: a.region ?? "",
    postalCode: a.postalCode,
    countryCode: a.countryCode,
    phone: a.phone ?? "",
  }
}

type Props = {
  backHref: string
  backLabel: string
}

export function StoreProfileSettings({ backHref, backLabel }: Props) {
  const [dnsTarget, setDnsTarget] = useState("cname.affisell.com")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [logoUrlInput, setLogoUrlInput] = useState("")
  const [previewUrl, setPreviewUrl] = useState("")
  const [aiAvatarUrl, setAiAvatarUrl] = useState("")
  const [customDomain, setCustomDomain] = useState("")
  const [domainVerified, setDomainVerified] = useState(false)

  const [shipFrom, setShipFrom] = useState<AddrForm>(() => emptyAddr())
  const [returnAddr, setReturnAddr] = useState<AddrForm>(() => emptyAddr())
  const [returnSameAsShip, setReturnSameAsShip] = useState(true)
  const [logisticsBusy, setLogisticsBusy] = useState(false)
  const [logisticsMsg, setLogisticsMsg] = useState<string | null>(null)
  const [logisticsErr, setLogisticsErr] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const avatarPhotoRef = useRef<HTMLInputElement>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarErr, setAvatarErr] = useState<string | null>(null)
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null)

  const hydrate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/store/me", { credentials: "include", cache: "no-store" })
      const json = (await res.json()) as {
        store?: StoreRow
        dnsTarget?: string
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? "Failed to load profile")
      if (json.dnsTarget) setDnsTarget(json.dnsTarget)
      const st = json.store
      if (st) {
        setName(st.name)
        setDescription(st.description ?? "")
        setBannerUrl(st.bannerUrl ?? "")
        setLogoUrlInput(st.logoUrl ?? "")
        setPreviewUrl(st.logoUrl ?? "")
        setAiAvatarUrl(st.aiAvatarUrl ?? "")
        setCustomDomain(st.customDomain ?? "")
        setDomainVerified(st.domainVerified)
        const sf = parseSupplierLogisticsAddress(st.shipFromAddress)
        const rt = parseSupplierLogisticsAddress(st.returnAddress)
        setShipFrom(sf ? addrToForm(sf) : emptyAddr())
        setReturnAddr(rt ? addrToForm(rt) : emptyAddr())
        setReturnSameAsShip(!rt)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.set("name", name.trim().slice(0, 40))
      fd.set("description", description)
      fd.set("bannerUrl", bannerUrl.trim())
      fd.set("logoUrl", logoUrlInput.trim())
      fd.set("customDomain", customDomain.trim())

      const file = fileRef.current?.files?.[0]
      if (file) fd.append("logo", file)

      const res = await fetch("/api/store/update", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const json = (await res.json()) as { error?: string; store?: StoreRow }
      if (!res.ok) throw new Error(json.error ?? "Could not save")
      if (json.store) {
        setPreviewUrl(json.store.logoUrl ?? "")
        setLogoUrlInput(json.store.logoUrl ?? "")
        setAiAvatarUrl(json.store.aiAvatarUrl ?? "")
        setCustomDomain(json.store.customDomain ?? "")
        setDomainVerified(json.store.domainVerified)
      }
      if (fileRef.current) fileRef.current.value = ""
      setMessage("Store profile saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setSaving(false)
    }
  }

  async function verifyDomain() {
    setVerifyBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch("/api/store/verify-domain", {
        method: "POST",
        credentials: "include",
      })
      const json = (await res.json()) as { verified?: boolean; message?: string; error?: string }
      if (json.error) throw new Error(json.error)
      if (json.verified) {
        setDomainVerified(true)
        setMessage(json.message ?? "Domain verified")
      } else {
        setMessage(json.message ?? "Not verified yet")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed")
    } finally {
      setVerifyBusy(false)
    }
  }

  async function saveLogistics() {
    setLogisticsBusy(true)
    setLogisticsErr(null)
    setLogisticsMsg(null)
    try {
      const res = await fetch("/api/store/logistics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          shipFrom: shipFrom,
          returnSameAsShip: returnSameAsShip,
          returnAddress: returnSameAsShip ? undefined : returnAddr,
        }),
      })
      const json = (await res.json()) as { error?: string; ok?: boolean }
      if (!res.ok) throw new Error(json.error ?? "Could not save addresses")
      setLogisticsMsg("Shipping & return addresses saved.")
    } catch (e) {
      setLogisticsErr(e instanceof Error ? e.message : "Error")
    } finally {
      setLogisticsBusy(false)
    }
  }

  function onLogoFileChange(f: File | undefined) {
    if (!f) return
    const prevBlob = previewUrl.startsWith("blob:") ? previewUrl : ""
    if (prevBlob) URL.revokeObjectURL(prevBlob)
    const u = URL.createObjectURL(f)
    setPreviewUrl(u)
    setLogoUrlInput("")
  }

  async function generateAvatarFromLogo() {
    setAvatarBusy(true)
    setAvatarErr(null)
    setAvatarMsg(null)
    try {
      const fd = new FormData()
      fd.set("mode", "from-logo")
      const res = await fetch("/api/ai/store-avatar", { method: "POST", body: fd, credentials: "include" })
      const json = (await res.json()) as { error?: string; aiAvatarUrl?: string | null }
      if (!res.ok) throw new Error(json.error ?? "Generation failed")
      if (json.aiAvatarUrl) setAiAvatarUrl(json.aiAvatarUrl)
      setAvatarMsg("Affisell AI avatar updated.")
    } catch (e) {
      setAvatarErr(e instanceof Error ? e.message : "Error")
    } finally {
      setAvatarBusy(false)
    }
  }

  async function onAvatarPhotoPicked(file: File | undefined) {
    if (!file) return
    setAvatarBusy(true)
    setAvatarErr(null)
    setAvatarMsg(null)
    try {
      const fd = new FormData()
      fd.set("mode", "from-photo")
      fd.set("photo", file)
      const res = await fetch("/api/ai/store-avatar", { method: "POST", body: fd, credentials: "include" })
      const json = (await res.json()) as { error?: string; aiAvatarUrl?: string | null }
      if (!res.ok) throw new Error(json.error ?? "Generation failed")
      if (json.aiAvatarUrl) setAiAvatarUrl(json.aiAvatarUrl)
      setAvatarMsg("Affisell AI avatar updated from your photo.")
    } catch (e) {
      setAvatarErr(e instanceof Error ? e.message : "Error")
    } finally {
      setAvatarBusy(false)
      if (avatarPhotoRef.current) avatarPhotoRef.current.value = ""
    }
  }

  async function clearAiAvatar() {
    setAvatarBusy(true)
    setAvatarErr(null)
    setAvatarMsg(null)
    try {
      const res = await fetch("/api/ai/store-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clear: true }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Could not clear")
      setAiAvatarUrl("")
      setAvatarMsg("AI avatar removed.")
    } catch (e) {
      setAvatarErr(e instanceof Error ? e.message : "Error")
    } finally {
      setAvatarBusy(false)
    }
  }

  if (loading) {
    return <p className="text-gray-600">Loading store profile…</p>
  }

  return (
    <div className="mt-8">
      <Link href={backHref} className="text-sm text-gray-600 hover:text-gray-900">
        ← {backLabel}
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">Store Profile</h1>

      <form onSubmit={onSubmit} className="mt-8 space-y-10">
        {/* Store name */}
        <section>
          <label className="block text-sm font-medium text-gray-800">Store name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your store name"
            maxLength={40}
            required
            className="mt-2 w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          />
          <p className="mt-1 text-sm text-gray-500">This appears on your product pages</p>
        </section>

        {/* Banner + description */}
        <section>
          <label className="block text-sm font-medium text-gray-800">Banner image URL (optional)</label>
          <input
            type="url"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://…"
            className="mt-2 w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2"
          />
        </section>

        <section>
          <label className="block text-sm font-medium text-gray-800">Store description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell shoppers about your store"
            rows={3}
            maxLength={600}
            className="mt-2 w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2"
          />
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-700 dark:bg-zinc-900/30">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Warehouse &amp; returns</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Ship-from address (labels, carrier pickups). Return address is where buyers send approved returns
            (defaults to ship-from if unchecked below).
          </p>

          <div className="mt-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Ship from
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="sf-company">Company (optional)</Label>
                <Input
                  id="sf-company"
                  className="mt-1.5"
                  value={shipFrom.company}
                  onChange={(e) => setShipFrom((s) => ({ ...s, company: e.target.value }))}
                  maxLength={120}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="sf-line1">Address line 1</Label>
                <Input
                  id="sf-line1"
                  className="mt-1.5"
                  value={shipFrom.line1}
                  onChange={(e) => setShipFrom((s) => ({ ...s, line1: e.target.value }))}
                  maxLength={200}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="sf-line2">Address line 2 (optional)</Label>
                <Input
                  id="sf-line2"
                  className="mt-1.5"
                  value={shipFrom.line2}
                  onChange={(e) => setShipFrom((s) => ({ ...s, line2: e.target.value }))}
                  maxLength={120}
                />
              </div>
              <div>
                <Label htmlFor="sf-city">City</Label>
                <Input
                  id="sf-city"
                  className="mt-1.5"
                  value={shipFrom.city}
                  onChange={(e) => setShipFrom((s) => ({ ...s, city: e.target.value }))}
                  maxLength={120}
                />
              </div>
              <div>
                <Label htmlFor="sf-region">Region / state (optional)</Label>
                <Input
                  id="sf-region"
                  className="mt-1.5"
                  value={shipFrom.region}
                  onChange={(e) => setShipFrom((s) => ({ ...s, region: e.target.value }))}
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="sf-postal">Postal code</Label>
                <Input
                  id="sf-postal"
                  className="mt-1.5"
                  value={shipFrom.postalCode}
                  onChange={(e) => setShipFrom((s) => ({ ...s, postalCode: e.target.value }))}
                  maxLength={32}
                />
              </div>
              <div>
                <Label htmlFor="sf-cc">Country (ISO-2)</Label>
                <Input
                  id="sf-cc"
                  className="mt-1.5 uppercase"
                  value={shipFrom.countryCode}
                  onChange={(e) =>
                    setShipFrom((s) => ({ ...s, countryCode: e.target.value.toUpperCase().slice(0, 2) }))
                  }
                  maxLength={2}
                  placeholder="FR"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="sf-phone">Phone (optional)</Label>
                <Input
                  id="sf-phone"
                  className="mt-1.5"
                  value={shipFrom.phone}
                  onChange={(e) => setShipFrom((s) => ({ ...s, phone: e.target.value }))}
                  maxLength={40}
                />
              </div>
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={returnSameAsShip}
              onChange={(e) => setReturnSameAsShip(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Return address is the same as ship-from
            </span>
          </label>

          {!returnSameAsShip ? (
            <div className="mt-5 space-y-4 border-t border-zinc-200 pt-5 dark:border-zinc-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Return receiving address
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="rt-company">Company (optional)</Label>
                  <Input
                    id="rt-company"
                    className="mt-1.5"
                    value={returnAddr.company}
                    onChange={(e) => setReturnAddr((s) => ({ ...s, company: e.target.value }))}
                    maxLength={120}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="rt-line1">Address line 1</Label>
                  <Input
                    id="rt-line1"
                    className="mt-1.5"
                    value={returnAddr.line1}
                    onChange={(e) => setReturnAddr((s) => ({ ...s, line1: e.target.value }))}
                    maxLength={200}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="rt-line2">Address line 2 (optional)</Label>
                  <Input
                    id="rt-line2"
                    className="mt-1.5"
                    value={returnAddr.line2}
                    onChange={(e) => setReturnAddr((s) => ({ ...s, line2: e.target.value }))}
                    maxLength={120}
                  />
                </div>
                <div>
                  <Label htmlFor="rt-city">City</Label>
                  <Input
                    id="rt-city"
                    className="mt-1.5"
                    value={returnAddr.city}
                    onChange={(e) => setReturnAddr((s) => ({ ...s, city: e.target.value }))}
                    maxLength={120}
                  />
                </div>
                <div>
                  <Label htmlFor="rt-region">Region / state (optional)</Label>
                  <Input
                    id="rt-region"
                    className="mt-1.5"
                    value={returnAddr.region}
                    onChange={(e) => setReturnAddr((s) => ({ ...s, region: e.target.value }))}
                    maxLength={80}
                  />
                </div>
                <div>
                  <Label htmlFor="rt-postal">Postal code</Label>
                  <Input
                    id="rt-postal"
                    className="mt-1.5"
                    value={returnAddr.postalCode}
                    onChange={(e) => setReturnAddr((s) => ({ ...s, postalCode: e.target.value }))}
                    maxLength={32}
                  />
                </div>
                <div>
                  <Label htmlFor="rt-cc">Country (ISO-2)</Label>
                  <Input
                    id="rt-cc"
                    className="mt-1.5 uppercase"
                    value={returnAddr.countryCode}
                    onChange={(e) =>
                      setReturnAddr((s) => ({ ...s, countryCode: e.target.value.toUpperCase().slice(0, 2) }))
                    }
                    maxLength={2}
                    placeholder="FR"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="rt-phone">Phone (optional)</Label>
                  <Input
                    id="rt-phone"
                    className="mt-1.5"
                    value={returnAddr.phone}
                    onChange={(e) => setReturnAddr((s) => ({ ...s, phone: e.target.value }))}
                    maxLength={40}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" disabled={logisticsBusy} onClick={() => void saveLogistics()}>
              {logisticsBusy ? "Saving…" : "Save warehouse addresses"}
            </Button>
            {logisticsErr ? <p className="text-sm text-red-600">{logisticsErr}</p> : null}
            {logisticsMsg ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{logisticsMsg}</p> : null}
          </div>
        </section>

        {/* Logo */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Store Logo</h2>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt=""
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 rounded-lg border border-gray-200 object-contain"
              />
            ) : null}
            <div className="min-w-[200px] flex-1 max-w-lg">
              <input
                type="url"
                value={logoUrlInput}
                onChange={(e) => {
                  setLogoUrlInput(e.target.value)
                  if (fileRef.current) fileRef.current.value = ""
                  if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
                  setPreviewUrl(e.target.value.trim())
                }}
                placeholder="https:// logo URL"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <p className="my-1 text-sm text-gray-500">or</p>
              <label className="inline-block cursor-pointer rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50">
                Upload Logo
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => onLogoFileChange(e.target.files?.[0])}
                />
              </label>
              <p className="mt-2 text-xs text-gray-400">PNG recommended, 500×500px max</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/40 p-5 dark:border-violet-900/40 dark:from-violet-950/30 dark:via-zinc-950 dark:to-fuchsia-950/20">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Affisell AI store avatar</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Optional square illustration for your storefront and product pages — generated from your logo or a
                reference photo (stylized, not a photo clone). Uses Groq + Hugging Face when{" "}
                <code className="rounded bg-white/80 px-1 text-xs dark:bg-zinc-900/80">GROQ_API_KEY</code> and{" "}
                <code className="rounded bg-white/80 px-1 text-xs dark:bg-zinc-900/80">HF_TOKEN</code> are set.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-start gap-4">
            <div className="relative">
              {aiAvatarUrl ? (
                <Image
                  src={aiAvatarUrl}
                  alt="AI-generated store avatar"
                  width={96}
                  height={96}
                  unoptimized
                  className="h-24 w-24 rounded-2xl border border-violet-200/80 object-cover shadow-sm dark:border-violet-800/60"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-violet-300/70 bg-white/60 text-xs text-violet-700 dark:border-violet-700 dark:bg-zinc-900/50 dark:text-violet-300">
                  No avatar yet
                </div>
              )}
              {aiAvatarUrl ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                  AI
                </span>
              ) : null}
            </div>
            <div className="flex min-w-[200px] flex-1 flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={
                  avatarBusy ||
                  (!logoUrlInput.trim() &&
                    !previewUrl.startsWith("https") &&
                    !previewUrl.startsWith("/uploads"))
                }
                onClick={() => void generateAvatarFromLogo()}
                className="w-full max-w-sm border-violet-300 bg-white/90 hover:bg-violet-50 dark:border-violet-700 dark:bg-zinc-900/80 dark:hover:bg-violet-950/40"
              >
                {avatarBusy ? "Working…" : "Generate from logo"}
              </Button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Uses the logo already saved on your store. If you just uploaded a new file, click{" "}
                <strong>Save Store Profile</strong> first, then generate.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={avatarBusy}
                onClick={() => avatarPhotoRef.current?.click()}
                className="w-full max-w-sm border-violet-300 bg-white/90 hover:bg-violet-50 dark:border-violet-700 dark:bg-zinc-900/80 dark:hover:bg-violet-950/40"
              >
                Generate from photo…
              </Button>
              <input
                ref={avatarPhotoRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => void onAvatarPhotoPicked(e.target.files?.[0])}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">PNG or JPEG, max ~4 MB. Stylized illustration only.</p>
              {aiAvatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={avatarBusy}
                  onClick={() => void clearAiAvatar()}
                  className="self-start text-zinc-600 hover:text-red-700 dark:text-zinc-400 dark:hover:text-red-400"
                >
                  Remove AI avatar
                </Button>
              ) : null}
              {avatarErr ? <p className="text-sm text-red-600 dark:text-red-400">{avatarErr}</p> : null}
              {avatarMsg ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{avatarMsg}</p> : null}
            </div>
          </div>
        </section>

        {/* Custom domain */}
        <section>
          <label className="block text-sm font-medium text-gray-800">Custom domain</label>
          <input
            value={customDomain}
            onChange={(e) => {
              setCustomDomain(e.target.value)
              setDomainVerified(false)
            }}
            placeholder="yourstore.com"
            className="mt-2 w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2"
          />
          <p className="mt-1 text-sm text-gray-500">
            Enter your own domain. We&apos;ll provide DNS instructions.
          </p>

          {customDomain.trim() && !domainVerified ? (
            <div className="mt-3 rounded-lg bg-yellow-50 p-4 text-gray-900">
              <p className="text-sm font-medium">Add this CNAME record to your DNS:</p>
              <code className="mt-2 block break-all rounded bg-white px-2 py-1 text-sm">
                CNAME {customDomain.trim()} → {dnsTarget}
              </code>
              <button
                type="button"
                disabled={verifyBusy || saving}
                onClick={() => void verifyDomain()}
                className="mt-3 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium hover:bg-amber-100 disabled:opacity-50"
              >
                {verifyBusy ? "Checking…" : "Verify Domain"}
              </button>
            </div>
          ) : null}

          {customDomain.trim() && domainVerified ? (
            <p className="mt-2 text-sm text-green-700">Custom domain is verified.</p>
          ) : null}
        </section>

        <button
          type="submit"
          disabled={saving || verifyBusy}
          className="rounded-xl bg-black px-6 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Store Profile"}
        </button>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
      </form>
    </div>
  )
}
