import { StorefrontBuyerFlowFrame } from "@/components/storefront/storefront-buyer-flow-frame"

/** On a reseller's own host the legal pages sit inside the store chrome (a way back to the store); no-op on the platform. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <StorefrontBuyerFlowFrame>{children}</StorefrontBuyerFlowFrame>
}
