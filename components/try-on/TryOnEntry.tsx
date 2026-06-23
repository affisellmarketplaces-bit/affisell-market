"use client"

import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

type TriggerProps = {
  className?: string
  onOpen: () => void
}

/** PDP trigger only — pair with a single `<TryOnModal />` at page root. */
export function TryOnTrigger({ className, onOpen }: TriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={onOpen}
      aria-haspopup="dialog"
    >
      <Sparkles className="mr-2 h-4 w-4 text-violet-600" aria-hidden />
      Try on
    </Button>
  )
}
