"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"

import { TryOnModal } from "@/components/try-on/TryOnModal"
import { Button } from "@/components/ui/button"

type Props = {
  productId: string
  affiliateProductId: string
  productName: string
  tryOnEnabled: boolean
  tryOnGarmentUrl: string | null
  featureEnabled: boolean
  className?: string
}

export function TryOnEntry({
  productId,
  affiliateProductId,
  productName,
  tryOnEnabled,
  tryOnGarmentUrl,
  featureEnabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false)

  if (!featureEnabled || !tryOnEnabled || !tryOnGarmentUrl?.trim()) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Sparkles className="mr-2 h-4 w-4 text-violet-600" aria-hidden />
        Try on
      </Button>
      <TryOnModal
        open={open}
        onClose={() => setOpen(false)}
        productId={productId}
        affiliateProductId={affiliateProductId}
        productName={productName}
      />
    </>
  )
}
