"use client"

import { useRouter } from "next/navigation"

import { AddPayoutMethodDrawer } from "@/components/affiliate/AddPayoutMethodDrawer"

/** Shared drawer trigger with router refresh after successful add. */
export function PayoutMethodsPageClient() {
  const router = useRouter()
  return <AddPayoutMethodDrawer onSuccess={() => router.refresh()} />
}
