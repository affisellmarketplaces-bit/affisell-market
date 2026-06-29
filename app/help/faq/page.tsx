import type { Metadata } from "next"

import { BuyerFaqPage, generateBuyerFaqMetadata } from "@/components/support/buyer-faq-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateBuyerFaqMetadata()
}

/** FAQ acheteur — langage simple, sans jargon B2B. */
export default function HelpFaqPage() {
  return <BuyerFaqPage />
}
