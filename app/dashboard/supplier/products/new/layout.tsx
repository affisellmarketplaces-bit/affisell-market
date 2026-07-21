import { Suspense, type ReactNode } from "react"

import { RadarImportPrefillBanner } from "@/components/radar/RadarImportPrefillBanner"

export default function SupplierNewProductLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <RadarImportPrefillBanner />
      </Suspense>
      {children}
    </>
  )
}
