"use client"

import { MerchantNotificationsMenu } from "@/components/merchant-notifications-menu"

export function SupplierNotificationsMenu({ className }: { className?: string }) {
  return <MerchantNotificationsMenu role="SUPPLIER" className={className} />
}
