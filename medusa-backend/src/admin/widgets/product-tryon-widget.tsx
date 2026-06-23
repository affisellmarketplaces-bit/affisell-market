"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminProduct } from "@medusajs/framework/types"
import { Badge, Container, Heading, Input, Switch, Text, toast } from "@medusajs/ui"

type TryOnPayload = {
  try_on_enabled: boolean
  tryon_garment_url: string | null
}

type ProductWithTryOn = AdminProduct & {
  product_try_on?: TryOnPayload | null
  try_on_enabled?: boolean
  tryon_garment_url?: string | null
}

function readTryOn(product: ProductWithTryOn): TryOnPayload {
  const linked = product.product_try_on
  return {
    try_on_enabled: linked?.try_on_enabled ?? product.try_on_enabled ?? false,
    tryon_garment_url: linked?.tryon_garment_url ?? product.tryon_garment_url ?? null,
  }
}

function isPhysicalProduct(product: AdminProduct): boolean {
  const value = product.type?.value ?? ""
  return String(value).toLowerCase() === "physical"
}

const ProductTryOnWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const initial = useMemo(() => readTryOn(product as ProductWithTryOn), [product])
  const [enabled, setEnabled] = useState(initial.try_on_enabled)
  const [garmentUrl, setGarmentUrl] = useState(initial.tryon_garment_url ?? "")
  const [saving, setSaving] = useState(false)
  const [previewOk, setPreviewOk] = useState(true)

  useEffect(() => {
    const next = readTryOn(product as ProductWithTryOn)
    setEnabled(next.try_on_enabled)
    setGarmentUrl(next.tryon_garment_url ?? "")
  }, [product.id, product.updated_at])

  const persist = useCallback(
    async (nextEnabled: boolean, nextUrl: string) => {
      setSaving(true)
      try {
        const res = await fetch(`/admin/products/${product.id}/try-on`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            try_on_enabled: nextEnabled,
            tryon_garment_url: nextUrl.trim() || null,
          }),
        })
        const body = (await res.json()) as { message?: string }
        if (!res.ok) {
          throw new Error(body.message ?? "Save failed")
        }
        toast.success("Virtual Try-On saved")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
      } finally {
        setSaving(false)
      }
    },
    [product.id]
  )

  const onToggle = async (checked: boolean) => {
    setEnabled(checked)
    await persist(checked, garmentUrl)
  }

  const onUrlBlur = async () => {
    if (garmentUrl.trim()) {
      const lower = garmentUrl.split("?")[0]?.toLowerCase() ?? ""
      if (!/\.(png|jpe?g|webp)$/.test(lower)) {
        toast.error("Use PNG, JPG, or WebP URL")
        return
      }
    }
    await persist(enabled, garmentUrl)
  }

  if (!isPhysicalProduct(product)) {
    return null
  }

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Heading level="h2">Virtual Try-On</Heading>
          <Badge size="2xsmall" color="purple">
            ✨ AI Powered
          </Badge>
        </div>
      </div>
      <div className="space-y-4 px-6 pb-6">
        <div className="flex items-center justify-between gap-4">
          <Text size="small" weight="plus">
            Activer Virtual Try-On
          </Text>
          <Switch checked={enabled} disabled={saving} onCheckedChange={onToggle} />
        </div>
        {enabled ? (
          <>
            <div className="space-y-2">
              <Text size="small" className="text-ui-fg-subtle">
                URL image flat-lay (PNG/JPG — Vercel Blob ou Cloudinary)
              </Text>
              <Input
                value={garmentUrl}
                disabled={saving}
                placeholder="https://….blob.vercel-storage.com/….png"
                onChange={(e) => setGarmentUrl(e.target.value)}
                onBlur={onUrlBlur}
              />
            </div>
            {garmentUrl.trim() ? (
              <div className="overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={garmentUrl.trim()}
                  alt="Garment preview"
                  className="mx-auto max-h-40 object-contain p-2"
                  onLoad={() => setPreviewOk(true)}
                  onError={() => setPreviewOk(false)}
                />
                {!previewOk ? (
                  <Text size="xsmall" className="px-3 pb-3 text-ui-fg-error">
                    Preview failed — check URL
                  </Text>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default ProductTryOnWidget
