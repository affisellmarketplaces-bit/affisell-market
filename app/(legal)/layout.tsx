import type { ReactNode } from "react"

import { StorefrontBuyerFlowFrame } from "@/components/storefront/storefront-buyer-flow-frame"

/** Public legal/contact pages: store chrome on a reseller's own host, untouched on the platform. */
export default function LegalRouteLayout({ children }: { children: ReactNode }) {
  return <StorefrontBuyerFlowFrame>{children}</StorefrontBuyerFlowFrame>
}
