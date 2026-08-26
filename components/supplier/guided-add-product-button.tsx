"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCallback, useId, useMemo, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, Loader2, Sparkles, XCircle } from "lucide-react"
import { toast } from "sonner"

import { BentoCard } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { isGpsrCompliant } from "@/lib/legal/gpsr"
import { formatStoreCurrency } from "@/lib/market-config"
import { processProductGalleryImageFile } from "@/lib/product-image-upload"
import { cn } from "@/lib/utils"

const GUIDED_CATEGORIES = [
  { label: "Fashion", value: "Clothing, Shoes & Jewelry" },
  { label: "Home", value: "Home & Kitchen" },
  { label: "Beauty", value: "Beauty & Personal Care" },
  { label: "Food", value: "Grocery & Gourmet Food" },
] as const

const STEP_LABELS = ["Base", "Détails", "GPSR EU", "Preview"] as const

type GuidedCategory = (typeof GUIDED_CATEGORIES)[number]["label"]

type FormState = {
  imagePreview: string | null
  imageUrl: string | null
  title: string
  category: GuidedCategory | ""
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
  material: "Coton bio",
  color: "Noir",
  dimensions: "30 × 20 × 5 cm",
  stock: "10",
  price: "29.99",
  manufacturerName: "",
  manufacturerAddress: "",
  manufacturerEmail: "",
  safetyWarning: "",
  notice: "",
}

type Props = {
  supplierId: string
  shopId?: string | null
}

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-zinc-200 bg-white/90 px-3 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"

const labelClass = "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"

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

export function GuidedAddProductButton({ supplierId, shopId: _shopId }: Props) {
  const router = useRouter()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)

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
  }, [form.imagePreview])

  const close = useCallback(() => {
    setOpen(false)
    resetWizard()
  }, [resetWizard])

  function patchForm(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
    setStepError(null)
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
    } catch (e) {
      setStepError(e instanceof Error ? e.message : "upload_failed")
    } finally {
      setUploading(false)
    }
  }

  function validateStep(current: number): boolean {
    if (current === 0) {
      if (!form.title.trim()) {
        setStepError("Titre requis")
        return false
      }
      if (!form.category) {
        setStepError("Choisissez une catégorie")
        return false
      }
      if (!form.imageUrl) {
        setStepError("Ajoutez une photo produit")
        return false
      }
      return true
    }
    if (current === 1) {
      if (!priceValid) {
        setStepError("Prix invalide (ex. 29.99)")
        return false
      }
      if (!form.material.trim() || !form.color.trim()) {
        setStepError("Matériau et couleur requis")
        return false
      }
      return true
    }
    if (current === 2) {
      if (!gpsrCheck.compliant) {
        setStepError("Obligatoire pour vendre en EU (GPSR)")
        return false
      }
      return true
    }
    return true
  }

  function goNext() {
    if (!validateStep(step)) return
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1))
  }

  function goBack() {
    setStepError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  async function publish() {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
      setStepError("Complétez toutes les étapes avant publication")
      return
    }
    if (!gpsrCheck.compliant) {
      setStepError("Obligatoire pour vendre en EU (GPSR)")
      setStep(2)
      return
    }

    const categoryValue = GUIDED_CATEGORIES.find((c) => c.label === form.category)?.value
    if (!categoryValue || !form.imageUrl) return

    setPublishing(true)
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

      const res = await fetch("/api/supplier/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.title.trim(),
          price: Number.parseFloat(form.price.replace(",", ".")),
          stock: stockN,
          images: [form.imageUrl],
          categories: [categoryValue],
          colors: [form.color.trim()],
          commissionRate: 15,
          listingKind: "PHYSICAL",
          warehouseType: "local",
          shippingCountry: "FR",
          deliveryCountryCodes: ["FR", "DE", "BE", "ES", "IT", "NL", "PT", "LU"],
          productAttributes,
          saveAsDraft: false,
        }),
      })

      const data = (await res.json()) as { id?: string; error?: string; verificationStatus?: string }
      if (!res.ok) {
        if (data.error === "merchant_verification_pending") {
          throw new Error("Vérification marchand en cours — complétez votre profil légal.")
        }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      if (!data.id) throw new Error("missing_product_id")

      console.log("[guided-add-product]", {
        result: "published",
        supplierId,
        productId: data.id,
        gpsrCompliant: true,
      })

      toast.success("Produit publié — GPSR conforme ✓")
      close()
      router.push(`/dashboard/supplier/products/${data.id}`)
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "publish_failed"
      setStepError(msg)
      toast.error(msg)
    } finally {
      setPublishing(false)
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
        ✨ Add Produit Guidé
      </button>

      <Sheet open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <SheetContent
          side="bottom"
          className="flex max-h-[min(92dvh,780px)] w-full flex-col overflow-hidden rounded-t-3xl border-zinc-200 bg-zinc-50 p-0 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="border-b border-zinc-200/80 bg-white/95 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
                  Wizard guidé · sans IA
                </p>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Nouveau produit en 4 étapes</h2>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={close}
              >
                ×
              </button>
            </div>
            <ol className="mt-4 flex gap-1">
              {STEP_LABELS.map((label, i) => (
                <li key={label} className="flex-1">
                  <div
                    className={cn(
                      "rounded-full py-1 text-center text-[10px] font-semibold uppercase tracking-wide",
                      i === step
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                        : i < step
                          ? "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    )}
                  >
                    {i + 1}. {label}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <p className={labelClass}>Photo produit</p>
                  <label
                    htmlFor={inputId}
                    className={cn(
                      "mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-300/60 bg-violet-50/50 py-8 transition hover:border-violet-500 dark:border-violet-800 dark:bg-violet-950/20",
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
                        <span className="text-sm font-medium text-violet-800 dark:text-violet-200">
                          Glisser ou cliquer — 1 image
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
                    Titre
                  </label>
                  <input
                    id="guided-title"
                    className={fieldClass}
                    value={form.title}
                    onChange={(e) => patchForm({ title: e.target.value })}
                    placeholder="ex. T-shirt oversize premium"
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="guided-category">
                    Catégorie
                  </label>
                  <select
                    id="guided-category"
                    className={fieldClass}
                    value={form.category}
                    onChange={(e) => patchForm({ category: e.target.value as GuidedCategory | "" })}
                  >
                    <option value="">— Choisir —</option>
                    {GUIDED_CATEGORIES.map((c) => (
                      <option key={c.label} value={c.label}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["material", "Matériau", form.material],
                    ["color", "Couleur", form.color],
                    ["dimensions", "Dimensions", form.dimensions],
                    ["stock", "Stock", form.stock],
                    ["price", "Prix (€)", form.price],
                  ] as const
                ).map(([key, label, value]) => (
                  <div key={key} className={key === "price" ? "sm:col-span-2" : ""}>
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
                <p className="sm:col-span-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Pré-rempli style Bento — ajustez avant publication.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <BentoCard className="border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                    GPSR obligatoire UE (Reg. 2023/988)
                  </p>
                  <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                    Fabricant identifié requis pour vendre en Union européenne.
                  </p>
                </BentoCard>
                {(
                  [
                    ["manufacturerName", "Fabricant — Nom *", form.manufacturerName],
                    ["manufacturerAddress", "Fabricant — Adresse *", form.manufacturerAddress],
                    ["manufacturerEmail", "Fabricant — Email *", form.manufacturerEmail],
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
                    Avertissement sécurité
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
                    Notice
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
                      {form.category} · Stock {stockN} · {form.material}
                    </p>
                  </div>
                </BentoCard>
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
                      <CheckCircle2 className="size-5" /> GPSR : ✅ Compliant
                    </>
                  ) : (
                    <>
                      <XCircle className="size-5" /> GPSR : ❌ Manque infos
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

          <div className="flex gap-2 border-t border-zinc-200 bg-white/95 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-6">
            {step > 0 ? (
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-xl")}
                onClick={goBack}
                disabled={publishing}
              >
                <ChevronLeft className="mr-1 size-4" />
                Retour
              </button>
            ) : (
              <div />
            )}
            {step < STEP_LABELS.length - 1 ? (
              <button
                type="button"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "ml-auto flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 sm:flex-none"
                )}
                onClick={goNext}
                disabled={uploading}
              >
                Suivant
                <ChevronRight className="ml-1 size-4" />
              </button>
            ) : (
              <button
                type="button"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "ml-auto flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 sm:flex-none",
                  !gpsrCheck.compliant && "opacity-50"
                )}
                disabled={!gpsrCheck.compliant || publishing || !priceValid}
                onClick={() => void publish()}
              >
                {publishing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Publication…
                  </>
                ) : (
                  "Publish"
                )}
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
