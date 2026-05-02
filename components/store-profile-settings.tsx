"use client"

import Link from "next/link"
import type { FormEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

type StoreRow = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  bannerUrl: string | null
  description: string | null
  customDomain: string | null
  domainVerified: boolean
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
  const [customDomain, setCustomDomain] = useState("")
  const [domainVerified, setDomainVerified] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

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
        setCustomDomain(st.customDomain ?? "")
        setDomainVerified(st.domainVerified)
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

  function onLogoFileChange(f: File | undefined) {
    if (!f) return
    const prevBlob = previewUrl.startsWith("blob:") ? previewUrl : ""
    if (prevBlob) URL.revokeObjectURL(prevBlob)
    const u = URL.createObjectURL(f)
    setPreviewUrl(u)
    setLogoUrlInput("")
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

        {/* Logo */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Store Logo</h2>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
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
