"use client"

import { CalendarClock, Landmark, MapPin, Sparkles, Timer, UtensilsCrossed } from "lucide-react"
import { useTranslations } from "next-intl"

import { SupplierBookingSeatLayoutPanel } from "@/components/supplier/supplier-booking-seat-layout-panel"
import { SupplierBookingSlotsManager } from "@/components/supplier/supplier-booking-slots-manager"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BookingSeatLayoutConfig } from "@/lib/booking/seat-layout"
import {
  isBookableListingKind,
  isExperienceListingKind,
  isMuseumListingKind,
  isRestaurantListingKind,
  isServiceListingKind,
} from "@/lib/booking/types"
import { cn } from "@/lib/utils"

type Props = {
  productId: string | null
  listingKind: string
  bookingDurationMinutes: string
  bookingCancellationHours: string
  bookingVenueLabel: string
  bookingInstantConfirm: boolean
  bookingSeatLayout: BookingSeatLayoutConfig
  slotPreviewCapacity: number
  onDurationChange: (v: string) => void
  onCancellationHoursChange: (v: string) => void
  onVenueLabelChange: (v: string) => void
  onInstantDeliveryChange: (v: boolean) => void
  onSeatLayoutChange: (v: BookingSeatLayoutConfig) => void
  className?: string
}

function hubCopyKeys(listingKind: string): {
  titleKey:
    | "titleService"
    | "titleExperience"
    | "titleRestaurant"
    | "titleMuseum"
  descriptionKey:
    | "descriptionService"
    | "descriptionExperience"
    | "descriptionRestaurant"
    | "descriptionMuseum"
  venueKey:
    | "venuePlaceholder"
    | "venuePlaceholderExperience"
    | "venuePlaceholderRestaurant"
    | "venuePlaceholderMuseum"
} {
  if (isRestaurantListingKind(listingKind)) {
    return {
      titleKey: "titleRestaurant",
      descriptionKey: "descriptionRestaurant",
      venueKey: "venuePlaceholderRestaurant",
    }
  }
  if (isMuseumListingKind(listingKind)) {
    return {
      titleKey: "titleMuseum",
      descriptionKey: "descriptionMuseum",
      venueKey: "venuePlaceholderMuseum",
    }
  }
  if (isExperienceListingKind(listingKind)) {
    return {
      titleKey: "titleExperience",
      descriptionKey: "descriptionExperience",
      venueKey: "venuePlaceholderExperience",
    }
  }
  return {
    titleKey: "titleService",
    descriptionKey: "descriptionService",
    venueKey: "venuePlaceholder",
  }
}

export function SupplierBookingHubPanel({
  productId,
  listingKind,
  bookingDurationMinutes,
  bookingCancellationHours,
  bookingVenueLabel,
  bookingInstantConfirm,
  bookingSeatLayout,
  slotPreviewCapacity,
  onDurationChange,
  onCancellationHoursChange,
  onVenueLabelChange,
  onInstantDeliveryChange,
  onSeatLayoutChange,
  className,
}: Props) {
  const t = useTranslations("supplier.booking")
  if (!isBookableListingKind(listingKind)) return null

  const isExperience = isExperienceListingKind(listingKind)
  const isRestaurant = isRestaurantListingKind(listingKind)
  const isMuseum = isMuseumListingKind(listingKind)
  const { titleKey, descriptionKey, venueKey } = hubCopyKeys(listingKind)
  const HubIcon = isRestaurant ? UtensilsCrossed : isMuseum ? Landmark : CalendarClock

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-cyan-300/50 bg-gradient-to-br from-cyan-950 via-slate-950 to-violet-950 p-6 text-white shadow-[0_0_80px_-20px_rgba(6,182,212,0.45)] ring-1 ring-cyan-400/20",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-52 w-52 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
            <HubIcon className="h-6 w-6 text-cyan-200" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">{t("badge")}</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">{t(titleKey)}</h3>
            <p className="mt-1 text-sm leading-relaxed text-cyan-100/85">{t(descriptionKey)}</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
          {isExperience ? <Sparkles className="h-3 w-3" aria-hidden /> : null}
          {t("liveBadge")}
        </span>
      </div>

      <div className="relative mt-6 space-y-5">
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
          <input
            type="checkbox"
            checked={bookingInstantConfirm}
            onChange={(e) => onInstantDeliveryChange(e.target.checked)}
            className="h-4 w-4 rounded border-cyan-300 text-cyan-600 focus:ring-cyan-400"
          />
          <span className="flex items-center gap-2 text-sm font-medium">{t("instantLabel")}</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="booking-duration" className="flex items-center gap-2 text-cyan-100">
              <Timer className="h-4 w-4 text-violet-300" aria-hidden />
              {t("durationLabel")}
            </Label>
            <Input
              id="booking-duration"
              type="number"
              min={5}
              max={480}
              className="mt-2 border-white/15 bg-black/30 text-white"
              value={bookingDurationMinutes}
              onChange={(e) => onDurationChange(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="booking-cancel-hours" className="flex items-center gap-2 text-cyan-100">
              {t("cancellationLabel")}
            </Label>
            <Input
              id="booking-cancel-hours"
              type="number"
              min={0}
              max={168}
              className="mt-2 border-white/15 bg-black/30 text-white"
              value={bookingCancellationHours}
              onChange={(e) => onCancellationHoursChange(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="booking-venue" className="flex items-center gap-2 text-cyan-100">
            <MapPin className="h-4 w-4 text-emerald-300" aria-hidden />
            {t("venueLabel")}
          </Label>
          <Input
            id="booking-venue"
            className="mt-2 border-white/15 bg-black/30 text-white"
            value={bookingVenueLabel}
            onChange={(e) => onVenueLabelChange(e.target.value)}
            placeholder={t(venueKey)}
          />
        </div>
      </div>

      {isExperience ? (
        <SupplierBookingSeatLayoutPanel
          config={bookingSeatLayout}
          previewCapacity={slotPreviewCapacity}
          onChange={onSeatLayoutChange}
        />
      ) : null}

      {productId ? (
        <SupplierBookingSlotsManager productId={productId} listingKind={listingKind} />
      ) : (
        <p className="relative mt-4 text-xs text-cyan-200/70">{t("saveDraftForSlots")}</p>
      )}
    </section>
  )
}
