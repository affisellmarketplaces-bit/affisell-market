"use client"

import Link from "next/link"

import type { MerchantRole } from "@/lib/legal/consent"
import { termsLabelForRole, termsSlugForRole } from "@/lib/legal/consent"
import { cn } from "@/lib/utils"

type Props = {
  role: MerchantRole
  cguChecked: boolean
  privacyChecked: boolean
  onCguChange: (v: boolean) => void
  onPrivacyChange: (v: boolean) => void
  /** CGS / CGA — requis pour SUPPLIER et AFFILIATE */
  roleTermsChecked?: boolean
  onRoleTermsChange?: (v: boolean) => void
  className?: string
}

export function LegalSignupConsent({
  role,
  cguChecked,
  privacyChecked,
  onCguChange,
  onPrivacyChange,
  roleTermsChecked = false,
  onRoleTermsChange,
  className,
}: Props) {
  const termsSlug = termsSlugForRole(role)
  const roleTermsLabel = termsLabelForRole(role).replace(/^CGU et /, "")
  const isMerchant = role === "SUPPLIER" || role === "AFFILIATE"

  return (
    <div className={cn("space-y-3 text-sm text-zinc-600 dark:text-zinc-400", className)}>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          required
          checked={cguChecked}
          onChange={(e) => onCguChange(e.target.checked)}
          className="mt-0.5 size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
        />
        <span>
          J&apos;accepte les{" "}
          <Link
            href="/cgu"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            CGU
          </Link>{" "}
          <span className="text-red-600 dark:text-red-400">*</span>
        </span>
      </label>

      {isMerchant && onRoleTermsChange ? (
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            required
            checked={roleTermsChecked}
            onChange={(e) => onRoleTermsChange(e.target.checked)}
            className="mt-0.5 size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
          />
          <span>
            J&apos;accepte les{" "}
            <Link
              href={`/legal/${termsSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
            >
              {roleTermsLabel}
            </Link>{" "}
            <span className="text-red-600 dark:text-red-400">*</span>
          </span>
        </label>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          required
          checked={privacyChecked}
          onChange={(e) => onPrivacyChange(e.target.checked)}
          className="mt-0.5 size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
        />
        <span>
          J&apos;accepte la{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            Politique de confidentialité
          </Link>{" "}
          <span className="text-red-600 dark:text-red-400">*</span>
        </span>
      </label>
    </div>
  )
}
