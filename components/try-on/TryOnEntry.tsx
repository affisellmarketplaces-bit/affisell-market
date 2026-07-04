"use client"

import { Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TriggerProps = {
  className?: string
  onOpen: () => void
  /** Branded shop PDP — uses `--store-accent` and glass styling. */
  variant?: "default" | "immersive"
}

/** PDP trigger only — pair with a single `<TryOnModal />` at page root. */
export function TryOnTrigger({ className, onOpen, variant = "default" }: TriggerProps) {
  const t = useTranslations("boutique.tryOn")
  const immersive = variant === "immersive"

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(immersive && "store-tryon-immersive", className)}
      onClick={onOpen}
      aria-haspopup="dialog"
    >
      <Sparkles
        className={cn("mr-2 h-4 w-4", immersive ? "store-pdp-accent-icon" : "text-violet-600")}
        aria-hidden
      />
      {t("cta")}
    </Button>
  )
}
