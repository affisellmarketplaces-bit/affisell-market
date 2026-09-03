import { isDropForgeImportComplete } from "@/lib/dropforge-complete-import"
import { dropForgeImportFailureMessage } from "@/lib/dropforge-import-diagnostics"
import {
  buildResellerPreviewFromAgent,
  resellerImportPreviewJson,
  type ResellerImportPreview,
} from "@/lib/affiliate-url-import.server"
import { detectMarketplaceFromUrl } from "@/lib/import-marketplace"
import { runProductImportAgent } from "@/lib/product-import-agent"

export { resellerImportPreviewJson }

/** Build DropForge preview from browser-captured __AER_DATA__ (Express Bridge). */
export async function buildDropForgePreviewFromAerCapture(
  aeUrl: string,
  aerData: unknown
): Promise<
  | { ok: true; preview: ResellerImportPreview; payload: { preview: ReturnType<typeof resellerImportPreviewJson> } }
  | { ok: false; error: string; status: number }
> {
  const agent = await runProductImportAgent({
    url: aeUrl,
    aerData,
    options: { markup: 2.8, aiRewrite: false, fast: true },
  })

  if (!agent.ok) {
    return { ok: false, error: agent.error, status: agent.status }
  }

  const preview = buildResellerPreviewFromAgent(agent, aeUrl, "AliExpress")

  if (!isDropForgeImportComplete(preview)) {
    return {
      ok: false,
      error:
        "Capture navigateur incomplète — rechargez la page AliExpress puis réessayez le pont Express.",
      status: 422,
    }
  }

  console.log("[dropforge-ae-import]", {
    stage: "aer-capture",
    result: "ok",
    method: agent.method,
    titleLen: preview.title.length,
    imageCount: preview.images.length,
    variantCount: preview.variants.length,
  })

  return {
    ok: true,
    preview,
    payload: { preview: resellerImportPreviewJson(preview) },
  }
}

/** Re-export for API routes — detect marketplace label from URL. */
export function dropForgeMarketplaceLabel(url: string): string {
  return detectMarketplaceFromUrl(url).label
}

export async function dropForgeIncompleteCaptureMessage(url: string): Promise<string> {
  return dropForgeImportFailureMessage(dropForgeMarketplaceLabel(url), true)
}
