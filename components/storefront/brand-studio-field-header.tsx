"use client"

import type { ReactNode } from "react"

import { BrandStudioGenerateButton } from "@/components/storefront/brand-studio-generate-button"
import type { BrandFieldGenerateResponse, BrandStudioGenerateField } from "@/lib/storefront-brand-field-generate-shared"
import type { BrandLaunchNiche } from "@/lib/storefront-brand-launch"
import type { HomepageSectionType } from "@/lib/storefront-sections-shared"
import { cn } from "@/lib/utils"

type Props = {
  htmlFor?: string
  label: ReactNode
  hint?: ReactNode
  className?: string
  labelClassName?: string
  generate?: {
    field: BrandStudioGenerateField
    role: "AFFILIATE" | "SUPPLIER"
    disabled?: boolean
    niche?: BrandLaunchNiche | null
    sectionType?: HomepageSectionType
    onApply: (result: BrandFieldGenerateResponse) => void
  }
}

export function BrandStudioFieldHeader({
  htmlFor,
  label,
  hint,
  className,
  labelClassName,
  generate,
}: Props) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        {htmlFor ? (
          <label
            htmlFor={htmlFor}
            className={cn(
              "text-xs font-semibold uppercase tracking-wider text-gray-500",
              labelClassName
            )}
          >
            {label}
          </label>
        ) : (
          <p className={cn("text-xs font-semibold uppercase tracking-wider text-gray-500", labelClassName)}>
            {label}
          </p>
        )}
        {hint ? <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{hint}</p> : null}
      </div>
      {generate ? (
        <BrandStudioGenerateButton
          field={generate.field}
          role={generate.role}
          disabled={generate.disabled}
          niche={generate.niche}
          sectionType={generate.sectionType}
          onApply={generate.onApply}
        />
      ) : null}
    </div>
  )
}
