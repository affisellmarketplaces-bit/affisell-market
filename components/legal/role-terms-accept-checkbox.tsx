"use client"

import Link from "next/link"

import type { MerchantRole } from "@/lib/legal/consent"
import { roleTermsHrefForRole, roleTermsLabelForRole } from "@/lib/legal/role-terms"
import { cn } from "@/lib/utils"

type Props = {
  role: "SUPPLIER" | "AFFILIATE"
  checked: boolean
  onChange: (v: boolean) => void
  className?: string
}

export function RoleTermsAcceptCheckbox({ role, checked, onChange, className }: Props) {
  const href = roleTermsHrefForRole(role)
  const label = roleTermsLabelForRole(role)

  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400", className)}>
      <input
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
      />
      <span>
        J&apos;accepte les{" "}
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
        >
          {label}
        </Link>{" "}
        <span className="text-red-600 dark:text-red-400">*</span>
      </span>
    </label>
  )
}
