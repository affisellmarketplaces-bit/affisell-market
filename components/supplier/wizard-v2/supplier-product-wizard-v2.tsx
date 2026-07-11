"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, Sparkles, Zap } from "lucide-react"
import { toast } from "sonner"

import { BentoShell } from "@/components/affisell/bento-ui"
import { ProductLivePreview } from "@/components/supplier/product-live-preview"
import { WizardV2ZeroWaitUpload } from "@/components/supplier/wizard-v2/wizard-v2-zero-wait-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  trackWizardV2Abandon,
  trackWizardV2PublishBlocked,
  trackWizardV2PublishSuccess,
  trackWizardV2StepComplete,
  trackWizardV2View,
} from "@/lib/analytics/wizard-v2-posthog"
import { buildWizardV2PublishBody } from "@/lib/product-wizard-v2/build-publish-payload"
import {
  instantScanStageFromVisionVersion,
  trackInstantScanGateTriggered,
  trackInstantScanResult,
} from "@/lib/telemetry"
import {
  hasShopifyIntegration,
  shopifyDomainFromIntegrations,
} from "@/lib/product-wizard-v2/shopify-detect"
import type { WizardV2Mode } from "@/lib/product-wizard-v2/feature-flag"
import { resolveWizardV2Mode } from "@/lib/product-wizard-v2/feature-flag"
import { buildUrlImportFormPatch } from "@/lib/url-import-apply"
import { publishBlockedUploadMessage } from "@/lib/upload/zero-wait-uploader"
import { cn } from "@/lib/utils"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

type MerchantDefaults = {
  countryCode: string | null
  warehouseType: string | null
  offerMode: string | null
  defaultCommissionPct: number | null
}

type Props = {
  ownerUserId: string
}

type InstantScanUiState = "idle" | "loading" | "done" | "gate" | "error"

const INSTANTSCAN_FETCH_TIMEOUT_MS = 45_000

const MODES: { id: WizardV2Mode; label: string; hint: string }[] = [
  { id: "express", label: "Express", hint: "URL → preview → publish (~15 s)" },
  { id: "guided", label: "InstantScan", hint: "Photo → InstantScan → prix (~60 s)" },
  { id: "pro", label: "Pro", hint: "Wizard classique v1" },
]

export function SupplierProductWizardV2({ ownerUserId }: Props) {
  const { push, replace, mounted } = useSafeAppRouter()
  const searchParams = useSearchParams()
  const mode = resolveWizardV2Mode(searchParams.get("mode"))
  const startedAt = useRef(Date.now())
  const stepStartedAt = useRef(Date.now())

  const [defaults, setDefaults] = useState<MerchantDefaults | null>(null)
  const [shopifyDomain, setShopifyDomain] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [uploadBusy, setUploadBusy] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [price, setPrice] = useState("")
  const [expressUrl, setExpressUrl] = useState("")
  const [guidedStep, setGuidedStep] = useState(0)
  const [instantScanState, setInstantScanState] = useState<InstantScanUiState>("idle")
  const instantScanImageRef = useRef<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<{
    title: string
    description: string
    categoryId: string | null
    suggestedPrice: number | null
  } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const lastStepRef = useRef("0")
  lastStepRef.current = String(guidedStep)

  useEffect(() => {
    trackWizardV2View({ mode, entry_point: "compose" })
    return () => {
      trackWizardV2Abandon({
        mode,
        last_step: lastStepRef.current,
        duration_ms: Date.now() - startedAt.current,
      })
    }
  }, [mode])

  useEffect(() => {
    if (!mounted || mode !== "pro") return
    replace("/dashboard/supplier/products/new?wizard=v1&compose=1", { scroll: false })
  }, [mode, mounted, replace])

  useEffect(() => {
    void fetch("/api/supplier/merchant-defaults", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { defaults?: MerchantDefaults } | null) => {
        if (j?.defaults) setDefaults(j.defaults)
      })
      .catch(() => {})

    void fetch("/api/supplier/integrations", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => {
        if (!Array.isArray(rows)) return
        const integrations = rows
          .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
          .map((r) => ({
            platform: String(r.platform ?? ""),
            shopDomain:
              typeof (r.config as Record<string, unknown> | undefined)?.shop === "string"
                ? String((r.config as Record<string, unknown>).shop)
                : null,
            name: typeof r.name === "string" ? r.name : null,
          }))
        if (hasShopifyIntegration(integrations)) {
          setShopifyDomain(shopifyDomainFromIntegrations(integrations))
        }
      })
      .catch(() => {})
  }, [])

  const previewData = useMemo(
    () => ({
      name,
      description,
      price: Number(price) || 0,
      imageUrl: images[0] ?? null,
    }),
    [name, description, price, images]
  )

  const completeStep = useCallback(
    (step: string) => {
      trackWizardV2StepComplete({
        step,
        duration_ms: Date.now() - stepStartedAt.current,
        method: mode,
      })
      stepStartedAt.current = Date.now()
    },
    [mode]
  )

  const runAiAnalyze = useCallback(async (imageUrl: string) => {
    setInstantScanState("loading")
    const toastId = toast.loading("InstantScan en cours...")
    const analyzeStarted = Date.now()
    const controller = new AbortController()
    const timeoutId = globalThis.setTimeout(() => controller.abort(), INSTANTSCAN_FETCH_TIMEOUT_MS)
    try {
      const res = await fetch("/api/ai/analyze-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageUrl }),
        signal: controller.signal,
      })
      const data = (await res.json()) as {
        title?: string
        description?: string
        categoryId?: string | null
        suggestedPrice?: number | null
        confidence?: number
        detectedModel?: string | null
        visionVersion?: string
        instantScanStage?: "embed" | "mini" | "gpt4o" | "groq"
        latencyMs?: number
        error?: string
        fallback?: string
      }
      if (!res.ok) {
        toast.dismiss(toastId)
        if (data.fallback === "manual") {
          const reason = data.error === "low_confidence" ? "low_confidence" : "ai_unavailable"
          trackInstantScanGateTriggered({ reason })
          setInstantScanState("gate")
          toast.message(
            data.error === "low_confidence"
              ? "InstantScan incertain - complétez manuellement"
              : "InstantScan indisponible — saisie manuelle"
          )
          return
        }
        throw new Error(data.error ?? "analyze_failed")
      }
      setAiSuggestion({
        title: data.title ?? "",
        description: data.description ?? "",
        categoryId: data.categoryId ?? null,
        suggestedPrice: data.suggestedPrice ?? null,
      })
      setInstantScanState("done")
      const modelLabel = data.detectedModel?.trim() || data.title?.trim() || "produit"
      trackInstantScanResult({
        model: data.detectedModel ?? data.title ?? null,
        confidence: data.confidence ?? null,
        latency_ms: data.latencyMs ?? Date.now() - analyzeStarted,
        stage: instantScanStageFromVisionVersion(data.visionVersion, data.instantScanStage),
      })
      toast.success(`✓ InstantScan : ${modelLabel} détecté`, { id: toastId })
    } catch (err) {
      toast.dismiss(toastId)
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? "timeout"
          : err instanceof Error
            ? err.message
            : "analyze_failed"
      trackInstantScanGateTriggered({ reason })
      setInstantScanState("error")
      toast.error(
        reason === "timeout"
          ? "InstantScan expiré — réessayez ou saisissez manuellement"
          : reason === "analyze_failed"
            ? "InstantScan impossible"
            : reason
      )
    } finally {
      globalThis.clearTimeout(timeoutId)
    }
  }, [])

  const retryInstantScan = useCallback(() => {
    instantScanImageRef.current = null
    setInstantScanState("idle")
    setAiSuggestion(null)
  }, [])

  useEffect(() => {
    setInstantScanState("idle")
    setAiSuggestion(null)
    instantScanImageRef.current = null
  }, [images[0]])

  useEffect(() => {
    const url = images[0]?.trim()
    if (mode !== "guided" || guidedStep !== 1 || !url?.startsWith("http")) return
    if (instantScanState !== "idle") return
    if (instantScanImageRef.current === url) return

    instantScanImageRef.current = url
    void runAiAnalyze(url)
  }, [mode, guidedStep, images, instantScanState, runAiAnalyze])

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return
    setName(aiSuggestion.title)
    setDescription(aiSuggestion.description)
    if (aiSuggestion.categoryId) setCategoryId(aiSuggestion.categoryId)
    if (aiSuggestion.suggestedPrice != null) setPrice(String(aiSuggestion.suggestedPrice))
    completeStep("ai_accept")
    setGuidedStep(2)
  }, [aiSuggestion, completeStep])

  const runExpressImport = useCallback(async () => {
    const u = expressUrl.trim()
    if (!/^https?:\/\//i.test(u)) {
      toast.error("URL invalide")
      return
    }
    setPublishing(true)
    try {
      const res = await fetch("/api/import-china", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: u, options: { aiRewrite: true, markup: 2.5 } }),
      })
      const data = (await res.json()) as { products?: unknown[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "import_failed")
      const raw = Array.isArray(data.products) ? data.products[0] : null
      const p =
        raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
      if (!p) throw new Error("no_product")
      const patch = buildUrlImportFormPatch(p, {
        markup: 2.5,
        categoryAttrs: [],
        commissionPct: String(defaults?.defaultCommissionPct ?? 15),
      })
      setName(patch.name)
      setDescription(patch.description)
      setPrice(String(patch.price))
      if (patch.categoryId) setCategoryId(patch.categoryId)
      if (patch.images[0]) setImages(patch.images)
      completeStep("express_import")
      toast.success("Produit importé — vérifiez l'aperçu")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible")
    } finally {
      setPublishing(false)
    }
  }, [completeStep, defaults?.defaultCommissionPct, expressUrl])

  const publish = useCallback(async () => {
    if (!defaults) {
      toast.error("Chargement des préférences…")
      return
    }
    if (uploadBusy) {
      const msg = publishBlockedUploadMessage(
        images.map((url, i) => ({
          id: String(i),
          fileName: "image",
          status: "uploading" as const,
          progress: 50,
          previewUrl: url,
          durableUrl: url.startsWith("http") ? url : null,
          error: null,
        }))
      )
      trackWizardV2PublishBlocked({ mode, reason: msg ?? "upload_busy", field: "images" })
      toast.error(msg ?? "Upload en cours")
      return
    }
    if (!name.trim()) {
      trackWizardV2PublishBlocked({ mode, reason: "missing_name", field: "name" })
      toast.error("Titre requis")
      return
    }
    if (!categoryId.trim()) {
      trackWizardV2PublishBlocked({ mode, reason: "missing_category", field: "category" })
      toast.error("Catégorie requise — acceptez la suggestion InstantScan ou passez en mode Pro")
      return
    }
    if (images.length === 0 || !images[0]?.startsWith("http")) {
      trackWizardV2PublishBlocked({ mode, reason: "images_not_ready", field: "images" })
      toast.error("Photo CDN requise")
      return
    }
    const priceN = Number(price)
    if (!Number.isFinite(priceN) || priceN <= 0) {
      trackWizardV2PublishBlocked({ mode, reason: "invalid_price", field: "price" })
      toast.error("Prix catalogue invalide")
      return
    }

    setPublishing(true)
    try {
      const body = buildWizardV2PublishBody(
        {
          name,
          description,
          price: priceN,
          categoryId,
          images,
          commission: defaults.defaultCommissionPct ?? 15,
        },
        defaults
      )

      const res = await fetch("/api/supplier/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { error?: string; id?: string }
      if (!res.ok) throw new Error(data.error ?? "publish_failed")

      await fetch("/api/supplier/gamification/award-product", {
        method: "POST",
        credentials: "include",
      }).catch(() => {})

      trackWizardV2PublishSuccess({
        mode,
        duration_total_ms: Date.now() - startedAt.current,
        ai_used: Boolean(aiSuggestion),
        image_count: images.length,
      })

      toast.success("🎉 Produit publié — +10 XP")
      push("/dashboard/supplier/products")
    } catch (err) {
      const reason = err instanceof Error ? err.message : "publish_failed"
      trackWizardV2PublishBlocked({ mode, reason, field: "api" })
      toast.error(reason)
    } finally {
      setPublishing(false)
    }
  }, [
    aiSuggestion,
    categoryId,
    defaults,
    description,
    images,
    mode,
    name,
    price,
    push,
    uploadBusy,
  ])

  if (mode === "pro") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
        Redirection vers le wizard Pro…
      </div>
    )
  }

  return (
    <BentoShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <header className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-600">Wizard v2</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Publier en 1 clic</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Mode {mode} — utilisateur {ownerUserId.slice(0, 8)}…
          </p>
        </header>

        {shopifyDomain ? (
          <div
            className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
            role="status"
          >
            Import depuis Shopify en ~10 s — boutique connectée :{" "}
            <strong>{shopifyDomain}</strong>
          </div>
        ) : null}

        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Mode wizard">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={cn(
                "rounded-xl border px-4 py-2 text-left text-sm transition",
                mode === m.id
                  ? "border-violet-500 bg-violet-50 font-semibold dark:bg-violet-950/50"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800"
              )}
              aria-pressed={mode === m.id}
              onClick={() => {
                const qs = new URLSearchParams(searchParams.toString())
                qs.set("wizard", "v2")
                qs.set("mode", m.id)
                replace(`/dashboard/supplier/products/new?${qs.toString()}`, { scroll: false })
              }}
            >
              <span className="block">{m.label}</span>
              <span className="text-xs font-normal text-zinc-500">{m.hint}</span>
            </button>
          ))}
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_1fr]">
          <div className="min-w-0 space-y-6">
            {mode === "express" ? (
              <section aria-labelledby="express-heading" className="space-y-4">
                <h2 id="express-heading" className="flex items-center gap-2 text-lg font-semibold">
                  <Zap className="h-5 w-5 text-amber-500" aria-hidden />
                  Express — collez une URL
                </h2>
                <Label htmlFor="express-url">URL produit (Shopify, marketplace…)</Label>
                <Input
                  id="express-url"
                  value={expressUrl}
                  onChange={(e) => setExpressUrl(e.target.value)}
                  placeholder="https://…"
                  className="h-11"
                />
                <Button type="button" disabled={publishing} onClick={() => void runExpressImport()}>
                  {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Analyser l&apos;URL
                </Button>
              </section>
            ) : (
              <section aria-labelledby="guided-heading" className="space-y-4">
                <h2 id="guided-heading" className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-5 w-5 text-violet-500" aria-hidden />
                  InstantScan — étape {guidedStep + 1}/3
                </h2>
                {guidedStep === 0 ? (
                  <>
                    <p className="text-sm text-zinc-600">Quelle est ta photo principale ?</p>
                    <WizardV2ZeroWaitUpload
                      onUrlsChange={setImages}
                      onBusyChange={setUploadBusy}
                    />
                    <Button
                      type="button"
                      disabled={!images[0]?.startsWith("http") || uploadBusy}
                      onClick={() => {
                        completeStep("photo")
                        setGuidedStep(1)
                      }}
                    >
                      Continuer
                    </Button>
                  </>
                ) : null}
                {guidedStep === 1 ? (
                  <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
                    {instantScanState === "loading" ? (
                      <p className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        InstantScan en cours…
                      </p>
                    ) : aiSuggestion && instantScanState === "done" ? (
                      <>
                        <p className="text-sm font-medium">InstantScan suggère :</p>
                        <p className="text-base font-semibold">{aiSuggestion.title}</p>
                        <p className="text-sm text-zinc-600 line-clamp-3">{aiSuggestion.description}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" onClick={applyAiSuggestion}>
                            Garder
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setGuidedStep(2)}>
                            Modifier
                          </Button>
                        </div>
                      </>
                    ) : instantScanState === "gate" ? (
                      <div className="space-y-3">
                        <p className="text-sm text-amber-900 dark:text-amber-100">
                          InstantScan incertain - complétez manuellement
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" onClick={() => setGuidedStep(2)}>
                            Saisie manuelle
                          </Button>
                          <Button type="button" variant="outline" onClick={retryInstantScan}>
                            Réessayer
                          </Button>
                        </div>
                      </div>
                    ) : instantScanState === "error" ? (
                      <div className="space-y-3">
                        <p className="text-sm text-red-700 dark:text-red-300">
                          InstantScan n&apos;a pas abouti.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" onClick={retryInstantScan}>
                            Réessayer
                          </Button>
                          <Button type="button" onClick={() => setGuidedStep(2)}>
                            Saisie manuelle
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" onClick={() => setGuidedStep(2)}>
                        Saisie manuelle
                      </Button>
                    )}
                  </div>
                ) : null}
                {guidedStep >= 2 ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="v2-name">Titre</Label>
                      <Input id="v2-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11" />
                    </div>
                    <div>
                      <Label htmlFor="v2-desc">Description</Label>
                      <textarea
                        id="v2-desc"
                        className="mt-1 min-h-[88px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="v2-price">Prix catalogue (EUR)</Label>
                      <Input
                        id="v2-price"
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1 h-11"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            )}

            {(mode === "express" || guidedStep >= 2) && (
              <div className="space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                {mode === "express" && images.length === 0 ? (
                  <WizardV2ZeroWaitUpload onUrlsChange={setImages} onBusyChange={setUploadBusy} />
                ) : null}
                {mode === "express" ? (
                  <>
                    <div>
                      <Label htmlFor="v2-express-name">Titre</Label>
                      <Input
                        id="v2-express-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 h-11"
                      />
                    </div>
                    <div>
                      <Label htmlFor="v2-express-price">Prix (EUR)</Label>
                      <Input
                        id="v2-express-price"
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="mt-1 h-11"
                      />
                    </div>
                  </>
                ) : null}

                <button
                  type="button"
                  className="text-sm font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                  aria-expanded={showAdvanced}
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  Avancé — logistique & commission
                </button>
                {showAdvanced && defaults ? (
                  <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
                    <p>Pays : {defaults.countryCode}</p>
                    <p>Zone : {defaults.warehouseType}</p>
                    <p>Commission : {defaults.defaultCommissionPct} %</p>
                  </div>
                ) : null}

                <Button
                  type="button"
                  size="lg"
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600"
                  disabled={publishing || uploadBusy}
                  onClick={() => void publish()}
                >
                  {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Publier le produit
                </Button>
                <p className="text-xs text-zinc-500">
                  <a href="?wizard=v1&compose=1" className="underline">
                    Ouvrir le wizard classique (v1)
                  </a>
                </p>
              </div>
            )}
          </div>

          <ProductLivePreview data={previewData} variant="sidebar" />
        </div>
        <ProductLivePreview data={previewData} variant="drawer" />
      </div>
    </BentoShell>
  )
}
