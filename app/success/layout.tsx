import { StorefrontBuyerFlowFrame } from "@/components/storefront/storefront-buyer-flow-frame"

export const dynamic = "force-dynamic"

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return <StorefrontBuyerFlowFrame>{children}</StorefrontBuyerFlowFrame>
}
