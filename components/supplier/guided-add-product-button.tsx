"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, Loader2, Sparkles, X, XCircle } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { BentoCard } from "@/components/affisell/bento-ui"
import { HoneypotField } from "@/components/security/honeypot-field"
import { GuidedAiCopilotPanel } from "@/components/supplier/guided-ai-copilot-panel"
import { GuidedCategoryPicker } from "@/components/supplier/guided-category-picker"
import { GuidedTaxonomySuggestions } from "@/components/supplier/guided-taxonomy-suggestions"
import { useGuidedProductAi } from "@/components/supplier/use-guided-product-ai"
import { useGuidedTaxonomySuggestions } from "@/components/supplier/use-guided-taxonomy-suggestions"
import { buttonVariants } from "@/components/ui/button"
import {
  GUIDED_WIZARD_CATEGORIES,
  formatGuidedPrice,
  mergeGuidedCategoryScores,
  pickGuidedCategoryFromScores,
  scoreGuidedCategoriesFromText,
  shouldAutoApplyGuidedCategory,
  type GuidedCategoryLabel,
  type GuidedProductAiSuggestion,
} from "@/lib/guided-product-ai-shared"
import { isGpsrCompliant } from "@/lib/legal/gpsr-compliance-shared"
import { blockIfHoneypotValue } from "@/lib/security/honeypot-client"
import { formatStoreCurrency } from "@/lib/market-config"
import { DELIVERY_WORLDWIDE, suggestDeliveryCountriesFromWarehouse } from "@/lib/supplier-delivery-countries"
import { visitorCountryDisplayName } from "@/lib/visitor-country"
import { processProductGalleryImageFile } from "@/lib/product-image-upload"
import { cn } from "@/lib/utils"

const STEP_KEYS = ["stepBasics", "stepDetails", "stepGpsr", "stepPreview"] as const

type GuidedCategory = GuidedCategoryLabel

type FormFieldKey = keyof FormState

type FormState = {
  imagePreview: string | null
  imageUrl: string | null
  title: string
  category: GuidedCategory | ""
  /** Exact leaf of the real taxonomy (optional — empty keeps the coarse shelf + background auto-categorisation). */
  leafId: string
  leafBreadcrumb: string
  description: string
  descriptionBullets: string[]
  material: string
  color: string
  dimensions: string
  stock: string
  price: string
  manufacturerName: string
  manufacturerAddress: string
  manufacturerEmail: string
  safetyWarning: string
  notice: string
}

const DEFAULT_FORM: FormState = {
  imagePreview: null,
  imageUrl: null,
  title: "",
  category: "",
  leafId: "",
  leafBreadcrumb: "",
  description: "",
  descriptionBullets: [],
  // No invented product data: material / colour / dimensions / price / stock start empty (the copilot suggests
  // from the title and photo; the supplier confirms). A pre-filled "Coton bio · Noir" could be published by mistake.
  material: "",
  color: "",
  dimensions: "",
  stock: "",
  price: "",
  manufacturerName: "",
  manufacturerAddress: "",
  manufacturerEmail: "",
  safetyWarning: "",
  notice: "",
}

const DESCRIPTION_MIN_LENGTH = 40

type ShippingDefaults = {
  countryCode: string
  warehouseType: "local" | "regional" | "international"
  deliveryCountryCodes: string[]
  commissionPct: number
  /** True when read from the supplier's own settings (not the conservative fallback). */
  fromProfile: boolean
}

/** Conservative fallback used only while/if the supplier's defaults cannot be loaded. */
const FALLBACK_SHIPPING_DEFAULTS: ShippingDefaults = {
  countryCode: "FR",
  warehouseType: "local",
  deliveryCountryCodes: ["FR", "DE", "BE", "ES", "IT", "NL", "PT", "LU"],
  commissionPct: 15,
  fromProfile: false,
}

const FIELD_PLACEHOLDER_KEYS = {
  material: "phMaterial",
  color: "phColor",
  dimensions: "phDimensions",
  stock: "phStock",
  price: "phPrice",
} as const

type Props = {
  supplierId: string
  shopId?: string | null
  /** From ?guided=1 — opens wizard on load. */
  defaultOpen?: boolean
}

/** Lien direct — ouvre le wizard guidé (connexion fournisseur requise). */
export const GUIDED_ADD_PRODUCT_HREF = "/dashboard/supplier/products?guided=1" as const

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/25 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"

const labelClass = "text-xs font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-200"

async function uploadProcessedBlob(blob: Blob, fileName: string): Promise<string> {
  const form = new FormData()
  form.append("file", blob, `${fileName}.jpg`)
  const res = await fetch("/api/upload/processed-image", {
    method: "POST",
    credentials: "include",
    body: form,
  })
  const json = (await res.json()) as { url?: string; detail?: string; error?: string }
  if (!res.ok) throw new Error(json.detail ?? json.error ?? "upload_failed")
  const url = json.url?.trim()
  if (!url) throw new Error("missing_url")
  return url
}

export function GuidedAddProductButton({
  supplierId,
  shopId: _shopId,
  defaultOpen = false,
}: Props) {
  const router = useRouter()
  const tFee = useTranslations("supplier.feeGrid")
  const tTax = useTranslations("supplier.guidedTaxonomy")
  const tDesc = useTranslations("supplier.guidedDescription")
  const tDef = useTranslations("supplier.guidedDefaults")
  const tWiz = useTranslations("supplier.guidedWizard")
  const [savingDraft, setSavingDraft] = useState(false)
  const locale = useLocale()
  const [shipDefaults, setShipDefaults] = useState<ShippingDefaults>(FALLBACK_SHIPPING_DEFAULTS)
  const defaultsLoaded = useRef(false)
  const [descLoading, setDescLoading] = useState(false)
  const [descError, setDescError] = useState<string | null>(null)
  const descAutoTried = useRef(false)
  const inputId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [userEdited, setUserEdited] = useState<Set<FormFieldKey>>(() => new Set())
  const honeypotRef = useRef<HTMLInputElement>(null)
  const aiEnabled = open && step <= 1
  const { suggestion: aiSuggestion, loading: aiLoading, error: aiError, refresh: refreshAi } =
    useGuidedProductAi(
      { title: form.title, imageUrl: form.imageUrl, imagePreview: form.imagePreview },
      aiEnabled
    )

  // The supplier's own shop defaults (origin country, warehouse type, average commission) instead of hard-coded values.
  useEffect(() => {
    if (!open || defaultsLoaded.current) return
    defaultsLoaded.current = true
    void fetch("/api/supplier/merchant-defaults", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: {
          defaults?: { countryCode?: string | null; warehouseType?: string | null; defaultCommissionPct?: number | null }
          hasSavedProfile?: boolean
        } | null) => {
          const d = data?.defaults
          if (!d) return
          const country = /^[A-Za-z]{2}$/.test(d.countryCode ?? "") ? d.countryCode!.toUpperCase() : "FR"
          const saved = Boolean(data?.hasSavedProfile)
          const wt =
            saved && (d.warehouseType === "local" || d.warehouseType === "regional" || d.warehouseType === "international")
              ? d.warehouseType
              : "local"
          const pct =
            typeof d.defaultCommissionPct === "number" && Number.isFinite(d.defaultCommissionPct)
              ? Math.min(50, Math.max(1, Math.round(d.defaultCommissionPct)))
              : FALLBACK_SHIPPING_DEFAULTS.commissionPct
          setShipDefaults({
            countryCode: country,
            warehouseType: wt,
            // Saved profile → what the supplier configured; otherwise stay conservative (as before).
            deliveryCountryCodes: saved
              ? suggestDeliveryCountriesFromWarehouse({ warehouseType: wt, shippingCountry: country })
              : FALLBACK_SHIPPING_DEFAULTS.deliveryCountryCodes,
            commissionPct: pct,
            fromProfile: true,
          })
        }
      )
      .catch(() => undefined)
  }, [open])

  const taxonomy = useGuidedTaxonomySuggestions(form.title, form.imageUrl, aiEnabled)

  // Strong, vision-backed match → pre-select it (the supplier can change or clear it). Never overrides a choice.
  useEffect(() => {
    if (!taxonomy.autoApply || !taxonomy.recommendedLeafId) return
    if (form.leafId || userEdited.has("leafId")) return
    const pick = taxonomy.suggestions.find((s) => s.leafId === taxonomy.recommendedLeafId)
    if (pick) setForm((prev) => (prev.leafId ? prev : { ...prev, leafId: pick.leafId, leafBreadcrumb: pick.breadcrumb }))
  }, [taxonomy.autoApply, taxonomy.recommendedLeafId, taxonomy.suggestions, form.leafId, userEdited])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  const gpsrCheck = useMemo(
    () =>
      isGpsrCompliant({
        manufacturerName: form.manufacturerName,
        manufacturerAddress: form.manufacturerAddress,
        manufacturerEmail: form.manufacturerEmail,
        safetyWarning: form.safetyWarning,
        notice: form.notice,
      }),
    [form.manufacturerAddress, form.manufacturerEmail, form.manufacturerName, form.notice, form.safetyWarning]
  )

  const priceCents = Math.round(Number.parseFloat(form.price.replace(",", ".")) * 100)
  const priceValid = Number.isFinite(priceCents) && priceCents > 0
  const stockN = Math.max(0, Math.round(Number(form.stock) || 0))

  const resetWizard = useCallback(() => {
    if (form.imagePreview?.startsWith("blob:")) URL.revokeObjectURL(form.imagePreview)
    setForm(DEFAULT_FORM)
    setStep(0)
    setStepError(null)
    setUserEdited(new Set())
    setDescError(null)
    descAutoTried.current = false
  }, [form.imagePreview])

  const categoryScores = useMemo(
    () =>
      mergeGuidedCategoryScores(
        aiSuggestion.categoryScores,
        scoreGuidedCategoriesFromText(form.title)
      ),
    [aiSuggestion.categoryScores, form.title]
  )

  const recommendedCategory = useMemo(
    () => pickGuidedCategoryFromScores(categoryScores, { minConfidence: 0.28 })?.category ?? aiSuggestion.category,
    [aiSuggestion.category, categoryScores]
  )

  const applyAiSuggestion = useCallback(
    (next: GuidedProductAiSuggestion, edited: Set<FormFieldKey>, scores = categoryScores) => {
      setForm((prev) => {
        const patch: Partial<FormState> = {}

        if (!edited.has("title") && next.recommendedTitle?.trim()) {
          patch.title = next.recommendedTitle.trim().slice(0, 120)
        }

        const mergedScores = mergeGuidedCategoryScores(scores, next.categoryScores)
        const categoryPick =
          pickGuidedCategoryFromScores(mergedScores, { minConfidence: 0.28 }) ??
          (next.category ? { category: next.category, confidence: next.categoryConfidence, reason: next.categoryReason } : null)

        if (
          categoryPick &&
          shouldAutoApplyGuidedCategory(categoryPick.confidence, {
            visionUsed: next.visionUsed || Boolean(prev.imageUrl || prev.imagePreview),
            userEdited: edited.has("category"),
            currentCategory: prev.category,
          })
        ) {
          patch.category = categoryPick.category
        }

        if (Object.keys(patch).length === 0) return prev
        return { ...prev, ...patch }
      })
    },
    [categoryScores]
  )

  useEffect(() => {
    if (!aiEnabled || aiLoading) return
    applyAiSuggestion(aiSuggestion, userEdited, categoryScores)
  }, [aiEnabled, aiLoading, aiSuggestion, applyAiSuggestion, userEdited, categoryScores])

  useEffect(() => {
    if (userEdited.has("category") || form.category || aiLoading) return
    const localPick = pickGuidedCategoryFromScores(scoreGuidedCategoriesFromText(form.title), {
      minConfidence: 0.42,
    })
    if (!localPick || form.title.trim().length < 5) return
    setForm((prev) => (prev.category ? prev : { ...prev, category: localPick.category }))
  }, [aiLoading, form.category, form.title, userEdited])

  const close = useCallback(() => {
    setOpen(false)
    resetWizard()
    if (defaultOpen) {
      router.replace("/dashboard/supplier/products", { scroll: false })
    }
  }, [defaultOpen, resetWizard, router])

  function patchForm(patch: Partial<FormState>, opts?: { user?: boolean }) {
    setForm((prev) => ({ ...prev, ...patch }))
    setStepError(null)
    if (opts?.user) {
      setUserEdited((prev) => {
        const next = new Set(prev)
        for (const key of Object.keys(patch) as FormFieldKey[]) next.add(key)
        return next
      })
    }
  }

  function applyAiTitle(title: string) {
    patchForm({ title: title.trim().slice(0, 120) }, { user: true })
  }

  function applyAiAttribute(key: "material" | "color" | "dimensions" | "price", value: string) {
    patchForm({ [key]: value } as Partial<FormState>, { user: true })
  }

  async function handleImagePick(file: File | null) {
    if (!file) return
    setUploading(true)
    setStepError(null)
    try {
      const dataUrl = await processProductGalleryImageFile(file)
      if (form.imagePreview?.startsWith("blob:")) URL.revokeObjectURL(form.imagePreview)
      patchForm({ imagePreview: dataUrl })
      const blob = await (await fetch(dataUrl)).blob()
      const url = await uploadProcessedBlob(blob, file.name.replace(/\.[^.]+$/, "") || "product")
      patchForm({ imageUrl: url })
      void refreshAi()
    } catch (e) {
      setStepError(e instanceof Error ? e.message : "upload_failed")
    } finally {
      setUploading(false)
    }
  }

  function validateStep(current: number): boolean {
    if (current === 0) {
      if (!form.title.trim()) {
        setStepError(tWiz("errTitle"))
        return false
      }
      if (!form.category && !form.leafId) {
        setStepError(tWiz("errCategory"))
        return false
      }
      if (!form.imageUrl) {
        setStepError(tWiz("errPhoto"))
        return false
      }
      return true
    }
    if (current === 1) {
      if (!priceValid) {
        setStepError(tWiz("errPrice"))
        return false
      }
      if (!form.material.trim() || !form.color.trim()) {
        setStepError(tWiz("errMatColor"))
        return false
      }
      if (form.description.trim().length < DESCRIPTION_MIN_LENGTH) {
        setStepError(tDesc("tooShort", { min: DESCRIPTION_MIN_LENGTH }))
        return false
      }
      if (!/^\d+$/.test(form.stock.trim())) {
        setStepError(tWiz("errStock"))
        return false
      }
      return true
    }
    if (current === 2) {
      if (!gpsrCheck.compliant) {
        setStepError(tWiz("errGpsr"))
        return false
      }
      return true
    }
    return true
  }

  const generateDescription = useCallback(async () => {
    const title = form.title.trim()
    if (!title || descLoading) return
    setDescLoading(true)
    setDescError(null)
    try {
      const specs = [
        { label: "Matériau", value: form.material.trim() },
        { label: "Couleur", value: form.color.trim() },
        { label: "Dimensions", value: form.dimensions.trim() },
      ].filter((s) => s.value.length > 0)
      const res = await fetch("/api/supplier/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          notes: "",
          bullets: [],
          productSpecs: specs,
          categoryPath: form.leafBreadcrumb || form.category || "",
          productImageUrls: form.imageUrl && /^https?:\/\//i.test(form.imageUrl) ? [form.imageUrl] : [],
          productImageDataUrls: [],
          illustrationDataUrls: [],
          // Text only: never generate extra images from the quick wizard.
          generateMissingIllustrations: false,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        description?: string
        bulletPoints?: string[]
        error?: string
      }
      if (!res.ok || !data.description?.trim()) throw new Error(data.error ?? "unavailable")
      setForm((prev) => ({
        ...prev,
        description: data.description!.trim(),
        descriptionBullets: Array.isArray(data.bulletPoints) ? data.bulletPoints.slice(0, 6) : [],
      }))
    } catch {
      setDescError(tDesc("unavailable"))
    } finally {
      setDescLoading(false)
    }
  }, [descLoading, form.category, form.color, form.dimensions, form.imageUrl, form.leafBreadcrumb, form.material, form.title, tDesc])

  // First time the supplier reaches the details step with a title and a photo: draft the description once.
  useEffect(() => {
    if (step !== 1 || descAutoTried.current) return
    if (form.description.trim() || !form.title.trim() || !form.imageUrl) return
    descAutoTried.current = true
    void generateDescription()
  }, [step, form.description, form.title, form.imageUrl, generateDescription])

  function goNext() {
    if (step === 0 && !form.category && recommendedCategory && !userEdited.has("category")) {
      patchForm({ category: recommendedCategory })
    }
    if (!validateStep(step)) return
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1))
  }

  function goBack() {
    setStepError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  const publish = () => submitProduct(false)
  const saveDraft = () => submitProduct(true)

  /** Publish (all steps validated) or save as a private draft (title only — finish later, nothing goes live). */
  async function submitProduct(asDraft: boolean) {
    if (asDraft) {
      if (!form.title.trim()) {
        setStepError(tWiz("draftNeedsTitle"))
        return
      }
    } else {
      if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
        setStepError(tWiz("errComplete"))
        return
      }
      if (!gpsrCheck.compliant) {
        setStepError(tWiz("errGpsr"))
        setStep(2)
        return
      }
    }

    const categoryValue = GUIDED_WIZARD_CATEGORIES.find((c) => c.label === form.category)?.value
    if (!asDraft && ((!categoryValue && !form.leafId) || !form.imageUrl)) return

    if (blockIfHoneypotValue(honeypotRef.current?.value)) {
      toast.error(tWiz("botDetected"))
      return
    }

    if (asDraft) setSavingDraft(true)
    else setPublishing(true)
    setStepError(null)
    try {
      const productAttributes = [
        { key: "material", label: "Matériau", value: form.material.trim() },
        { key: "color", label: "Couleur", value: form.color.trim() },
        { key: "dimensions", label: "Dimensions", value: form.dimensions.trim() },
        { key: "gpsr_manufacturer_name", label: "Fabricant", value: form.manufacturerName.trim() },
        { key: "gpsr_manufacturer_address", label: "Adresse fabricant", value: form.manufacturerAddress.trim() },
        { key: "gpsr_manufacturer_email", label: "Email fabricant", value: form.manufacturerEmail.trim() },
        ...(form.safetyWarning.trim()
          ? [{ key: "gpsr_safety_warning", label: "Avertissement sécurité", value: form.safetyWarning.trim() }]
          : []),
        ...(form.notice.trim()
          ? [{ key: "gpsr_notice", label: "Notice", value: form.notice.trim() }]
          : []),
      ].filter((a) => a.value.length > 0)

      const send = (withLeaf: boolean) =>
        fetch("/api/supplier/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: form.title.trim(),
            description: form.description.trim(),
            descriptionBullets: form.descriptionBullets,
            // A draft may be incomplete: only send what the supplier actually filled in.
            ...(priceValid || !asDraft ? { price: Number.parseFloat(form.price.replace(",", ".")) } : {}),
            ...(form.stock.trim() || !asDraft ? { stock: stockN } : {}),
            images: form.imageUrl ? [form.imageUrl] : [],
            // With an exact taxonomy category the coarse shelf is redundant (the full form sends only categoryId).
            categories: categoryValue && !(withLeaf && form.leafId) ? [categoryValue] : [],
            // Exact category of the real taxonomy when chosen (better discovery, right commission grid).
            ...(withLeaf && form.leafId ? { categoryId: form.leafId } : {}),
            colors: form.color.trim() ? [form.color.trim()] : [],
            commissionRate: shipDefaults.commissionPct,
            listingKind: "PHYSICAL",
            warehouseType: shipDefaults.warehouseType,
            shippingCountry: shipDefaults.countryCode,
            deliveryCountryCodes: shipDefaults.deliveryCountryCodes,
            productAttributes,
            saveAsDraft: asDraft,
          }),
        })

      let res = await send(true)
      // The exact category can require attributes this short wizard does not collect (the API answers 400 with the
      // list). Never block the supplier: retry with the coarse shelf — background auto-categorisation still applies.
      if (res.status === 400 && form.leafId) {
        const probe = (await res.clone().json().catch(() => ({}))) as { errors?: unknown }
        if (probe.errors) res = await send(false)
      }

      const data = (await res.json()) as { id?: string; error?: string; verificationStatus?: string }
      if (!res.ok) {
        if (data.error === "merchant_verification_pending") {
          throw new Error(tWiz("errMerchant"))
        }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      if (!data.id) throw new Error("missing_product_id")

      console.log("[guided-add-product]", {
        result: asDraft ? "draft_saved" : "published",
        supplierId,
        productId: data.id,
        gpsrCompliant: !asDraft,
      })

      toast.success(asDraft ? tWiz("draftSaved") : tWiz("published"))
      close()
      router.push(`/dashboard/supplier/products/${data.id}`)
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "publish_failed"
      setStepError(msg)
      toast.error(msg)
    } finally {
      setPublishing(false)
      setSavingDraft(false)
    }
  }

  const previewImage = form.imagePreview ?? form.imageUrl

  return (
    <>
      <button
        type="button"
        className={cn(
          buttonVariants({ size: "lg" }),
          "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/25 hover:from-violet-500 hover:to-indigo-500 sm:w-auto"
        )}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {tFee("guidedAddProduct")}
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[500] flex items-end justify-center sm:items-center sm:p-4"
              role="presentation"
            >
              <button
                type="button"
                aria-label="Fermer le wizard"
                className="absolute inset-0 bg-zinc-950/70 backdrop-blur-[2px]"
                onClick={close}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="guided-wizard-title"
                className="relative z-10 flex max-h-[min(94dvh,820px)] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-2xl shadow-violet-950/20 sm:max-h-[min(88dvh,780px)] sm:rounded-3xl dark:border-zinc-700 dark:bg-zinc-900"
              >
                <HoneypotField inputRef={honeypotRef} />
                <div className="shrink-0 border-b border-zinc-200 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-4 text-white sm:px-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100">
                        {tWiz("eyebrow")}
                      </p>
                      <h2 id="guided-wizard-title" className="text-lg font-bold sm:text-xl">
                        {tWiz("heading")}
                      </h2>
                    </div>
                    <button
                      type="button"
                      aria-label={tWiz("close")}
                      className="rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
                      onClick={close}
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                  <ol className="mt-4 flex gap-1.5">
                    {STEP_KEYS.map((key, i) => (
                      <li key={key} className="flex-1">
                        <div
                          className={cn(
                            "rounded-full py-1.5 text-center text-[10px] font-bold uppercase tracking-wide sm:text-[11px]",
                            i === step
                              ? "bg-white text-violet-700 shadow-sm"
                              : i < step
                                ? "bg-white/30 text-white"
                                : "bg-white/10 text-violet-100"
                          )}
                        >
                          {i + 1}. {tWiz(key)}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-zinc-50 px-4 py-5 dark:bg-zinc-950 sm:px-6">
            {step === 0 && (
              <div className="space-y-4">
                {(form.imageUrl || form.imagePreview || form.title.trim() || aiLoading) ? (
                  <GuidedAiCopilotPanel
                    suggestion={aiSuggestion}
                    loading={aiLoading}
                    error={aiError}
                    currentTitle={form.title}
                    onApplyTitle={applyAiTitle}
                    onApplyAttribute={applyAiAttribute}
                    onRefresh={refreshAi}
                  />
                ) : null}
                <div>
                  <p className={labelClass}>Photo produit</p>
                  <label
                    htmlFor={inputId}
                    className={cn(
                      "mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-400 bg-violet-50 py-10 transition hover:border-violet-600 hover:bg-violet-100/80 dark:border-violet-600 dark:bg-violet-950/40",
                      uploading && "pointer-events-none opacity-60"
                    )}
                  >
                    {previewImage ? (
                      <div className="relative h-40 w-40 overflow-hidden rounded-xl ring-2 ring-white shadow-lg">
                        <Image src={previewImage} alt="" fill className="object-cover" unoptimized={previewImage.startsWith("blob:")} />
                      </div>
                    ) : (
                      <>
                        <ImagePlus className="mb-2 size-8 text-violet-500" />
                        <span className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                          {tWiz("dropzone")}
                        </span>
                      </>
                    )}
                    <input
                      id={inputId}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploading}
                      onChange={(e) => void handleImagePick(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {uploading ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-violet-600">
                      <Loader2 className="size-3.5 animate-spin" /> Upload…
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClass} htmlFor="guided-title">
                    {tWiz("titleLabel")}
                  </label>
                  <input
                    id="guided-title"
                    className={fieldClass}
                    value={form.title}
                    onChange={(e) => patchForm({ title: e.target.value }, { user: true })}
                    placeholder={tWiz("titlePlaceholder")}
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className={labelClass}>{tTax("title")}</label>
                  <GuidedTaxonomySuggestions
                    suggestions={taxonomy.suggestions}
                    identity={taxonomy.identity}
                    recommendedLeafId={taxonomy.recommendedLeafId}
                    selectedLeafId={form.leafId}
                    loading={taxonomy.loading}
                    failed={taxonomy.failed}
                    hasSignal={form.title.trim().length >= 3 || Boolean(form.imageUrl)}
                    disabled={uploading}
                    onRetry={taxonomy.retry}
                    onSelect={(s) =>
                      patchForm(
                        { leafId: s?.leafId ?? "", leafBreadcrumb: s?.breadcrumb ?? "" },
                        { user: true }
                      )
                    }
                  />
                </div>
                <details
                  key={form.leafId || taxonomy.suggestions.length > 0 ? "collapsed" : "open"}
                  open={!form.leafId && taxonomy.suggestions.length === 0}
                  className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                >
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    {tWiz("departmentLabel")}
                  </summary>
                  <div>
                  <GuidedCategoryPicker
                    value={form.category}
                    onChange={(category) => patchForm({ category }, { user: true })}
                    scores={categoryScores}
                    recommended={recommendedCategory}
                    loading={aiLoading && !form.category}
                    disabled={uploading}
                  />
                </div>
                </details>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <GuidedAiCopilotPanel
                    suggestion={aiSuggestion}
                    loading={aiLoading}
                    error={aiError}
                    currentTitle={form.title}
                    onApplyTitle={applyAiTitle}
                    onApplyAttribute={applyAiAttribute}
                    onRefresh={refreshAi}
                    compact
                  />
                </div>
                {(
                  [
                    ["material", tWiz("fieldMaterial"), form.material],
                    ["color", tWiz("fieldColor"), form.color],
                    ["dimensions", tWiz("fieldDimensions"), form.dimensions],
                    ["stock", tWiz("fieldStock"), form.stock],
                    ["price", tWiz("fieldPrice"), form.price],
                  ] as const
                ).map(([key, label, value]) => (
                  <div key={key} className={key === "price" ? "sm:col-span-2" : ""}>
                    <label className={labelClass} htmlFor={`guided-${key}`}>
                      {label}
                    </label>
                    <input
                      id={`guided-${key}`}
                      className={fieldClass}
                      placeholder={tWiz(FIELD_PLACEHOLDER_KEYS[key])}
                      inputMode={key === "price" || key === "stock" ? "decimal" : undefined}
                      value={value}
                      onChange={(e) =>
                        patchForm({ [key]: e.target.value } as Partial<FormState>, { user: true })
                      }
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className={labelClass} htmlFor="guided-description">
                      {tDesc("label")}
                    </label>
                    <button
                      type="button"
                      onClick={() => void generateDescription()}
                      disabled={descLoading || !form.title.trim()}
                      className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200 transition hover:bg-violet-100 disabled:opacity-50 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-800"
                    >
                      {descLoading ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : (
                        <Sparkles className="size-3" aria-hidden />
                      )}
                      {descLoading ? tDesc("generating") : form.description.trim() ? tDesc("regenerate") : tDesc("generate")}
                    </button>
                  </div>
                  <textarea
                    id="guided-description"
                    className={cn(fieldClass, "min-h-32 resize-y leading-relaxed")}
                    rows={6}
                    maxLength={5000}
                    value={form.description}
                    placeholder={tDesc("placeholder")}
                    onChange={(e) => patchForm({ description: e.target.value }, { user: true })}
                  />
                  <p className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{descError ?? tDesc("reviewHint")}</span>
                    <span className="tabular-nums">
                      {form.description.trim().length} / {DESCRIPTION_MIN_LENGTH}+
                    </span>
                  </p>
                </div>
                <p className="sm:col-span-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {aiSuggestion.attributes.suggestedPrice && !userEdited.has("price")
                    ? tWiz("aiPriceHint", { price: formatGuidedPrice(aiSuggestion.attributes.suggestedPrice) ?? "" })
                    : tWiz("aiHint")}
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <BentoCard className="border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                    {tWiz("gpsrTitle")}
                  </p>
                  <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                    {tWiz("gpsrBody")}
                  </p>
                </BentoCard>
                {(
                  [
                    ["manufacturerName", tWiz("mfrName"), form.manufacturerName],
                    ["manufacturerAddress", tWiz("mfrAddress"), form.manufacturerAddress],
                    ["manufacturerEmail", tWiz("mfrEmail"), form.manufacturerEmail],
                  ] as const
                ).map(([key, label, value]) => (
                  <div key={key}>
                    <label className={labelClass} htmlFor={`guided-${key}`}>
                      {label}
                    </label>
                    <input
                      id={`guided-${key}`}
                      className={fieldClass}
                      value={value}
                      onChange={(e) => patchForm({ [key]: e.target.value } as Partial<FormState>)}
                    />
                  </div>
                ))}
                <div>
                  <label className={labelClass} htmlFor="guided-safety">
                    {tWiz("safetyWarning")}
                  </label>
                  <textarea
                    id="guided-safety"
                    rows={2}
                    className={fieldClass}
                    value={form.safetyWarning}
                    onChange={(e) => patchForm({ safetyWarning: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="guided-notice">
                    {tWiz("notice")}
                  </label>
                  <textarea
                    id="guided-notice"
                    rows={2}
                    className={fieldClass}
                    value={form.notice}
                    onChange={(e) => patchForm({ notice: e.target.value })}
                  />
                </div>
                {!gpsrCheck.compliant && (form.manufacturerName || form.manufacturerEmail) ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                    <XCircle className="size-4 shrink-0" />
                    Obligatoire pour vendre en EU (GPSR)
                  </p>
                ) : null}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <BentoCard className="overflow-hidden !p-0">
                  <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
                    {previewImage ? (
                      <Image
                        src={previewImage}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized={previewImage.startsWith("blob:")}
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">{form.title || "—"}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-violet-700 dark:text-violet-300">
                      {priceValid ? formatStoreCurrency(priceCents / 100) : "—"}
                    </p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {form.category} · {tWiz("previewStock", { n: stockN })} · {form.material}
                    </p>
                  </div>
                </BentoCard>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{tDef("title")}</p>
                  <ul className="mt-1.5 space-y-0.5 text-zinc-600 dark:text-zinc-300">
                    <li>{tDef("shipsFrom", { country: visitorCountryDisplayName(shipDefaults.countryCode, locale) })}</li>
                    <li>
                      {shipDefaults.deliveryCountryCodes.includes(DELIVERY_WORLDWIDE)
                        ? tDef("deliversWorldwide")
                        : tDef("deliversTo", { count: shipDefaults.deliveryCountryCodes.length })}
                    </li>
                    <li>{tDef("commission", { pct: shipDefaults.commissionPct })}</li>
                  </ul>
                  <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{tDef("editHint")}</p>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold",
                    gpsrCheck.compliant
                      ? "border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                      : "border-red-300/80 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                  )}
                >
                  {gpsrCheck.compliant ? (
                    <>
                      <CheckCircle2 className="size-5" /> {tWiz("gpsrOk")}
                    </>
                  ) : (
                    <>
                      <XCircle className="size-5" /> {tWiz("gpsrMissing")}
                    </>
                  )}
                </div>
              </div>
            )}

            {stepError ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {stepError}
              </p>
            ) : null}
          </div>

                <div className="shrink-0 flex gap-2 border-t border-zinc-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-700 dark:bg-zinc-900 sm:px-6">
            {step > 0 ? (
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-xl")}
                onClick={goBack}
                disabled={publishing}
              >
                <ChevronLeft className="mr-1 size-4" />
                {tWiz("back")}
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              className="ml-auto rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-violet-300"
              onClick={() => void saveDraft()}
              disabled={publishing || savingDraft || uploading || !form.title.trim()}
            >
              {savingDraft ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  {tWiz("savingDraft")}
                </span>
              ) : (
                tWiz("saveDraft")
              )}
            </button>
            {step < STEP_KEYS.length - 1 ? (
              <button
                type="button"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 sm:flex-none"
                )}
                onClick={goNext}
                disabled={uploading}
              >
                {tWiz("next")}
                <ChevronRight className="ml-1 size-4" />
              </button>
            ) : (
              <button
                type="button"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 sm:flex-none",
                  !gpsrCheck.compliant && "opacity-50"
                )}
                disabled={!gpsrCheck.compliant || publishing || savingDraft || !priceValid}
                onClick={() => void publish()}
              >
                {publishing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {tWiz("publishing")}
                  </>
                ) : (
                  tWiz("publish")
                )}
              </button>
            )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
