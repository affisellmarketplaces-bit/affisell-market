"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

export function SupplierIntegrationsOAuthToast() {
  const params = useSearchParams()

  useEffect(() => {
    const connected = params.get("connected")
    const error = params.get("error")
    if (connected === "shopify") {
      toast.success("Shopify connecté — synchronisation initiale en cours")
    } else if (error === "shopify_oauth") {
      toast.error("Connexion Shopify échouée — réessayez")
    } else if (error === "encryption") {
      toast.error("ENCRYPTION_KEY manquante — configurez .env.local")
    }
  }, [params])

  return null
}
