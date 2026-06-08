"use client"

import { Camera, CameraOff, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SCAN_COOLDOWN_MS = 2500

type Props = {
  onScan: (raw: string) => void
  disabled?: boolean
  className?: string
}

export function SupplierBookingQrScanner({ onScan, disabled = false, className }: Props) {
  const t = useTranslations("supplier.booking.roster")
  const reactId = useId().replace(/:/g, "")
  const readerId = `booking-qr-${reactId}`
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null)
  const lastScanRef = useRef<{ raw: string; at: number } | null>(null)
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
      scanner.clear()
    } catch {
      // ignore teardown errors
    }
  }, [])

  useEffect(() => {
    if (!active || disabled) return

    let cancelled = false
    setStarting(true)
    setError(null)

    void (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode")
        if (cancelled) return

        const scanner = new Html5Qrcode(readerId)
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 8,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1,
          },
          (decoded) => {
            if (cancelled || disabled) return
            const now = Date.now()
            const last = lastScanRef.current
            if (last && last.raw === decoded && now - last.at < SCAN_COOLDOWN_MS) return
            lastScanRef.current = { raw: decoded, at: now }
            onScan(decoded)
          },
          () => undefined
        )

        if (cancelled) {
          try {
            if (scanner.isScanning) await scanner.stop()
            scanner.clear()
          } catch {
            // ignore teardown during fast unmount
          }
          return
        }

        scannerRef.current = scanner
        setStarting(false)
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        const permissionDenied =
          message.toLowerCase().includes("permission") ||
          message.toLowerCase().includes("notallowed")
        setError(permissionDenied ? t("cameraPermissionDenied") : t("cameraUnavailable"))
        setActive(false)
        setStarting(false)
      }
    })()

    return () => {
      cancelled = true
      void stopScanner()
    }
  }, [active, disabled, onScan, readerId, stopScanner, t])

  useEffect(() => {
    if (disabled && active) {
      setActive(false)
      void stopScanner()
    }
  }, [active, disabled, stopScanner])

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={active ? "outline" : "secondary"}
          className={cn(
            active
              ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
              : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          )}
          disabled={disabled || starting}
          onClick={() => {
            if (active) {
              setActive(false)
              void stopScanner()
              return
            }
            setError(null)
            setActive(true)
          }}
        >
          {starting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : active ? (
            <CameraOff className="h-4 w-4" aria-hidden />
          ) : (
            <Camera className="h-4 w-4" aria-hidden />
          )}
          {active ? t("cameraStopCta") : t("cameraScanCta")}
        </Button>
        <p className="text-xs text-cyan-100/70">{active ? t("cameraScanningHint") : t("orCameraManual")}</p>
      </div>

      <div
        id={readerId}
        className={cn(
          "overflow-hidden rounded-xl border border-white/10 bg-black/40",
          active ? "min-h-[240px]" : "hidden"
        )}
      />

      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
    </div>
  )
}
