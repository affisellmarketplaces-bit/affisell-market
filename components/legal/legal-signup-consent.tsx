"use client"

import Link from "next/link"

import type { MerchantRole } from "@/lib/legal/consent"
import { termsLabelForRole, termsSlugForRole } from "@/lib/legal/consent"
import { cn } from "@/lib/utils"

type Props = {
  role: MerchantRole
  termsChecked: boolean
  privacyChecked: boolean
  onTermsChange: (v: boolean) => void
  onPrivacyChange: (v: boolean) => void
  className?: string
}

export function LegalSignupConsent({
  role,
  termsChecked,
  privacyChecked,
  onTermsChange,
  onPrivacyChange,
  className,
}: Props) {
  const termsSlug = termsSlugForRole(role)
  const termsLabel = termsLabelForRole(role)

  return (
    <div className={cn("space-y-3 text-sm text-zinc-600 dark:text-zinc-400", className)}>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          required
          checked={termsChecked}
          onChange={(e) => onTermsChange(e.target.checked)}
          className="mt-0.5 size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
        />
        <span>
          J&apos;accepte les{" "}
          <Link href="/legal/terms-of-service" className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            CGU
          </Link>
          {role !== "CUSTOMER" ? (
            <>
              {" "}
              et les{" "}
              <Link href={`/legal/${termsSlug}`} className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
                {termsLabel.replace(/^CGU et /, "")}
              </Link>
            </>
          ) : null}{" "}
          <span className="text-red-600 dark:text-red-400">*</span>
        </span>
      </label>
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
          <Link href="/legal/privacy-policy" className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            Politique de confidentialité
          </Link>{" "}
          <span className="text-red-600 dark:text-red-400">*</span>
        </span>
      </label>
    </div>
  )
}
