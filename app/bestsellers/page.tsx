import { permanentRedirect } from "next/navigation"

import { BUYER_BESTSELLERS_PATH } from "@/lib/buyer-bestsellers-route"

/** Legacy `/bestsellers` → canonical marketplace hub. */
export default function BestsellersLegacyRedirectPage() {
  permanentRedirect(BUYER_BESTSELLERS_PATH)
}
