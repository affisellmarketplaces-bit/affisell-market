"use client"

import { Suspense, useCallback, useEffect, useOptimistic, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Camera, Loader2, Sparkles, Upload, X } from "lucide-react"

import { TryOnErrorBoundary } from "@/components/try-on/TryOnErrorBoundary"
import { Button } from "@/components/ui/button"
import { checkPoseFromImageFile } from "@/lib/try-on/client/pose-check"
import { smartCropUserPhoto } from "@/lib/try-on/client/smart-crop"
import {
  startTryOnJob,
  waitForTryOnResult,
} from "@/lib/try-on/try-on-client"
import { TRYON_CONSENT_VERSION } from "@/lib/try-on/try-on-shared"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onClose: () => void
  productId: string
  affiliateProductId: string
  productName: string
  garmentUrl: string
}

type Phase = "idle" | "uploading" | "processing" | "done" | "error"

function TryOnModalSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6" aria-hidden>
      <div className="h-6 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="aspect-[3/4] rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
  )
}

function TryOnModalInner({
  onClose,
  productId,
  affiliateProductId,
  productName,
  garmentUrl,
}: Omit<Props, "open">) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [poseWarning, setPoseWarning] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [optimisticOutput, setOptimisticOutput] = useOptimistic<string | null>(outputUrl)

  const resetPreview = useCallback(() => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPoseWarning(null)
    setError(null)
    setPhase("idle")
  }, [previewUrl])

  const handleClose = useCallback(() => {
    resetPreview()
    setOutputUrl(null)
    setConsent(false)
    onClose()
  }, [onClose, resetPreview])

  const runTryOn = useCallback(
    async (file: File) => {
      setError(null)
      setPhase("uploading")

      try {
        const pose = await checkPoseFromImageFile(file)
        if (!pose.ok) {
          setPoseWarning(pose.message)
        } else {
          setPoseWarning(null)
        }

        const cropped = await smartCropUserPhoto(file)
        const uploadFile =
          cropped.blob instanceof File
            ? cropped.blob
            : new File([cropped.blob], "selfie.jpg", { type: cropped.blob.type || "image/jpeg" })

        setPhase("processing")

        const started = await startTryOnJob({
          productId,
          affiliateProductId,
          inputUrl: "",
          selfieFile: uploadFile,
          garmentUrl,
        })

        if (started.status === "done" && started.outputUrl) {
          setOutputUrl(started.outputUrl)
          setOptimisticOutput(started.outputUrl)
          setPhase("done")
          return
        }

        if (!started.jobId) {
          throw new Error("No job id returned")
        }

        const final = await waitForTryOnResult(started.jobId)
        if (final.status === "done" && final.outputUrl) {
          setOutputUrl(final.outputUrl)
          setOptimisticOutput(final.outputUrl)
          setPhase("done")
        } else {
          throw new Error(final.error ?? "Try-on did not complete in time")
        }
      } catch (err) {
        console.error("[try-on]", {
          result: "client_run_failed",
          message: err instanceof Error ? err.message : String(err),
        })
        setError(err instanceof Error ? err.message : "Try-on failed")
        setPhase("error")
      }
    },
    [affiliateProductId, garmentUrl, productId, setOptimisticOutput]
  )

  const onFileChange = useCallback(
    async (file: File | null) => {
      if (!file || !consent) return
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      await runTryOn(file)
    },
    [consent, previewUrl, runTryOn]
  )

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tryon-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-950 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" aria-hidden />
            <h2 id="tryon-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Try before you buy
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Close try-on"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            See how <span className="font-medium text-zinc-900 dark:text-zinc-100">{productName}</span>{" "}
            looks on you — AI preview in seconds.
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300"
            />
            <span className="text-zinc-700 dark:text-zinc-300">
              I consent to processing my photo for this virtual try-on. My upload is deleted within 24h.
              Results are stored up to 30 days.{" "}
              <span className="text-xs text-zinc-500">({TRYON_CONSENT_VERSION})</span>
            </span>
          </label>

          {poseWarning ? (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
              {poseWarning}
            </p>
          ) : null}

          <div
            className={cn(
              "relative aspect-[3/4] overflow-hidden rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50",
              !consent && "opacity-60"
            )}
          >
            {optimisticOutput || previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={optimisticOutput ?? previewUrl ?? ""}
                alt="Try-on preview"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-zinc-500">
                <Camera className="h-8 w-8 opacity-60" aria-hidden />
                Upload or take a photo (upper body or full length)
              </div>
            )}

            {(phase === "uploading" || phase === "processing") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 dark:bg-zinc-950/80">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {phase === "uploading" ? "Preparing photo…" : "Generating try-on…"}
                </p>
              </div>
            )}
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!consent || phase === "uploading" || phase === "processing"}
              onClick={() => inputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Upload
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled
              title="Back view coming in V2"
              className="gap-2 opacity-50"
            >
              See back view
            </Button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
          />

          {phase === "done" && outputUrl ? (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-xs text-zinc-500"
            >
              Preview ready — lighting and fit may vary from the real garment.
            </motion.p>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  )
}

export function TryOnModal(props: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!props.open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [props.open])

  if (!mounted) return null

  return createPortal(
    <TryOnErrorBoundary>
      <AnimatePresence>
        {props.open ? (
          <Suspense fallback={<TryOnModalSkeleton />}>
            <TryOnModalInner {...props} />
          </Suspense>
        ) : null}
      </AnimatePresence>
    </TryOnErrorBoundary>,
    document.body
  )
}
