"use client"

import { RotatingSloganPro } from "@/components/ui/RotatingSloganPro"

/** @deprecated Prefer `RotatingSloganPro persona="reseller"` — kept for existing imports. */
export function RotatingResellerSlogan() {
  return <RotatingSloganPro persona="reseller" tone="dark" className="text-left" />
}
