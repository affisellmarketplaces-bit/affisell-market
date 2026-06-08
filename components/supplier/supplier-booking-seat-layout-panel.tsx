"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"

import { SupplierBookingSeatLayoutPreview } from "@/components/supplier/supplier-booking-seat-layout-preview"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DEFAULT_CINEMA_VIP_LAYOUT,
  DEFAULT_GRID_LAYOUT,
  layoutPreviewCapacity,
  type BookingSeatLayoutConfig,
  type SeatLayoutPreset,
} from "@/lib/booking/seat-layout"
import { cn } from "@/lib/utils"

type Props = {
  config: BookingSeatLayoutConfig
  previewCapacity: number
  onChange: (config: BookingSeatLayoutConfig) => void
  className?: string
}

export function SupplierBookingSeatLayoutPanel({
  config,
  previewCapacity,
  onChange,
  className,
}: Props) {
  const t = useTranslations("supplier.booking.seatLayout")
  const capacity = useMemo(
    () => layoutPreviewCapacity(config, previewCapacity),
    [config, previewCapacity]
  )

  function setPreset(preset: SeatLayoutPreset) {
    onChange(preset === "CINEMA_VIP" ? { ...DEFAULT_CINEMA_VIP_LAYOUT } : { ...DEFAULT_GRID_LAYOUT })
  }

  return (
    <div className={cn("space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4", className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{t("title")}</p>
        <p className="mt-1 text-xs leading-relaxed text-cyan-100/75">{t("description")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["GRID", "CINEMA_VIP"] as const).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setPreset(preset)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              config.preset === preset
                ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                : "border-white/15 bg-white/5 text-cyan-200/70 hover:bg-white/10"
            )}
          >
            {preset === "GRID" ? t("presetGrid") : t("presetCinemaVip")}
          </button>
        ))}
      </div>

      {config.preset === "CINEMA_VIP" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="seat-layout-cols" className="text-cyan-100">
              {t("colsLabel")}
            </Label>
            <Input
              id="seat-layout-cols"
              type="number"
              min={4}
              max={20}
              className="mt-1.5 border-white/15 bg-black/30 text-white"
              value={String(config.cols ?? 10)}
              onChange={(e) => {
                const n = Math.max(4, Math.min(20, Math.round(Number(e.target.value)) || 10))
                onChange({ ...config, cols: n })
              }}
            />
          </div>
          <div>
            <Label htmlFor="seat-layout-blocked" className="text-cyan-100">
              {t("blockedLabel")}
            </Label>
            <Input
              id="seat-layout-blocked"
              className="mt-1.5 border-white/15 bg-black/30 text-white"
              placeholder={t("blockedPlaceholder")}
              value={(config.blockedLabels ?? []).join(", ")}
              onChange={(e) => {
                const labels = e.target.value
                  .split(/[,;\s]+/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 20)
                onChange({
                  ...config,
                  blockedLabels: labels.length > 0 ? labels : undefined,
                })
              }}
            />
          </div>
        </div>
      ) : null}

      <SupplierBookingSeatLayoutPreview config={config} capacity={capacity} />
    </div>
  )
}
