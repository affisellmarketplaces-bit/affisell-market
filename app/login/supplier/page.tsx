import { Suspense } from "react"

import { PortalSignInForm } from "@/components/auth/portal-sign-in-form"

export default function SupplierLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement…</div>}>
      <PortalSignInForm
        portal="SUPPLIER"
        title="Espace Fournisseur"
        subtitle="Connecte-toi pour gérer tes produits et tes commandes"
        defaultCallback="/dashboard/supplier"
        signupHref="/signup/supplier"
        signupLabel="Créer un compte fournisseur"
      />
    </Suspense>
  )
}
