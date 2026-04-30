"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

export function ForceReleaseHoldsButton() {
  const [loading, setLoading] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      className="mt-8"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        try {
          await fetch("/api/cron/release", { method: "POST" })
          window.location.reload()
        } finally {
          setLoading(false)
        }
      }}
    >
      {loading ? "Libération…" : "Forcer libération maintenant"}
    </Button>
  )
}
