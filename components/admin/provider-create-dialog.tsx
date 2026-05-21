"use client"

import { useState } from "react"

import { ProviderForm } from "@/components/admin/provider-form"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"

type Props = {
  onCreated?: () => void
}

export function ProviderCreateDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="bentoAccent" onClick={() => setOpen(true)}>
        Nouveau fournisseur
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto p-6 sm:max-w-xl">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Créer un fournisseur</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Clés API scellées en AES-256-GCM — jamais stockées en clair.
          </p>
          <ProviderForm
            mode="create"
            compact
            onSuccess={() => {
              setOpen(false)
              onCreated?.()
            }}
            onCancel={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
