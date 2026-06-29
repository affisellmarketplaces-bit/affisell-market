import type { Metadata } from "next"

import {
  generateProtectedCheckoutMetadata,
  ProtectedCheckoutPage,
} from "@/components/legal/protected-checkout-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateProtectedCheckoutMetadata()
}

export default function ProtectedCheckoutRoutePage() {
  return <ProtectedCheckoutPage />
}
