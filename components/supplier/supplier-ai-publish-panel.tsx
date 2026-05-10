"use client"

import { useCallback, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"

type Props = {
  name: string
  description: string
  images: string[]
  categoryAttrs: CategoryAttrRow[]
  categoryPathLabel: string
  onGenerated: (description: string, specsPatch: Record<string, string>) => void
}

export function SupplierAiPublishPanel({
  name,
  description,
  images,
  categoryAttrs,
  categoryPathLabel,
  onGenerated,
}: Props) {
  const [loading, setLoading] = useState(false)

  const canRun =
    name.trim().length >= 2 || images.length >= 1 || description.trim().length >= 8

  const run = useCallback(async () => {
    if (!canRun) {
      toast.error("Add a name, a short description, or at least one image first.")
      return
    }
    setLoading(true)
    try {
      const characteristics = categoryAttrs.map((c) => ({
        key: c.key,
        label: c.label,
        type: c.type,
        options: c.options ?? [],
        required: c.required,
      }))
      const res = await fetch("/api/supplier/ai-product-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          imageUrls: images.filter((u) => /^https?:\/\//i.test(u)).slice(0, 4),
          categoryPath: categoryPathLabel,
          characteristics,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        description?: string
        specs?: Record<string, string>
      }
      if (!res.ok) throw new Error(data.error ?? "Generation failed")
      const desc = typeof data.description === "string" ? data.description : ""
      if (!desc.trim()) throw new Error("Empty response")
      const specs =
        data.specs && typeof data.specs === "object" && !Array.isArray(data.specs)
          ? (data.specs as Record<string, string>)
          : {}
      onGenerated(desc, specs)
      toast.success("Description and fields updated — review before publishing.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setLoading(false)
    }
  }, [canRun, name, description, images, categoryPathLabel, categoryAttrs, onGenerated])

  return (
    <Card className="border-zinc-200 bg-zinc-50/90 p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-zinc-950">
          <Sparkles className="h-5 w-5 text-zinc-800 dark:text-zinc-100" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Publish with AI</h2>
            <Badge
              variant="secondary"
              className="border border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
            >
              New
            </Badge>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Generate listing copy from your title, notes, and images.
          </p>
          <Button type="button" size="sm" disabled={loading || !canRun} onClick={() => void run()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Generating…
              </>
            ) : (
              "Generate with AI"
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}
