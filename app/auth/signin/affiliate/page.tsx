import { Suspense } from "react"

import { PortalSignInForm } from "@/components/auth/portal-sign-in-form"

export default function AffiliateSignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement…</div>}>
      <PortalSignInForm
        portal="AFFILIATE"
        title="Espace Créateur"
        subtitle="Connectez-vous pour accéder au catalogue affilié et à vos marges."
        defaultCallback="/marketplace"
        signupHref="/signup/affiliate"
        signupLabel="Créer un compte créateur"
      />
    </Suspense>
  )
}
