"use client"

import { useTranslations } from "next-intl"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { trustedCarrierGroupsForCountry } from "@/lib/trusted-carriers-shared"
import type { ShipTrackingPolicy } from "@/lib/ship-tracking-policy.shared"

type Props = {
  id?: string
  value: string
  onValueChange: (value: string) => void
  countryIso2: string
  policy?: ShipTrackingPolicy
  disabled?: boolean
  ariaLabel: string
  placeholder: string
  className?: string
}

/**
 * Every European destination has its real, locally-known carriers first (national post + regional couriers),
 * then the pan-European networks (DHL, UPS, FedEx, DPD, GLS) as a fallback that works everywhere.
 */
export function ShipTrackingCarrierPicker({
  id,
  value,
  onValueChange,
  countryIso2,
  policy,
  disabled,
  ariaLabel,
  placeholder,
  className,
}: Props) {
  const t = useTranslations("supplierOrders.carrierPicker")
  const groups = trustedCarrierGroupsForCountry(countryIso2, policy)

  return (
    <Select value={value} onValueChange={(v) => v && onValueChange(v)} disabled={disabled}>
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.national.length > 0 ? (
          <SelectGroup>
            <SelectLabel>{t("groupNational")}</SelectLabel>
            {groups.national.map((row) => (
              <SelectItem key={row.label} value={row.label}>
                {row.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        {groups.network.length > 0 ? (
          <SelectGroup>
            <SelectLabel>{t("groupNetwork")}</SelectLabel>
            {groups.network.map((row) => (
              <SelectItem key={row.label} value={row.label}>
                {row.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        {groups.other.length > 0 ? (
          <SelectGroup>
            <SelectLabel>{t("groupOther")}</SelectLabel>
            {groups.other.map((row) => (
              <SelectItem key={row.label} value={row.label}>
                {row.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
      </SelectContent>
    </Select>
  )
}
