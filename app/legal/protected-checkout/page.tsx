import { redirect } from "next/navigation"

/** Alias `/legal/protected-checkout` → page canonique B2C. */
export default function LegalProtectedCheckoutAliasPage() {
  redirect("/protected-checkout")
}
