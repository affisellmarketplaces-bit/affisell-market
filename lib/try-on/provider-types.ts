import "server-only"

export type TryOnProviderInput = {
  humanImageUrl: string
  garmentImageUrl: string
  garmentDescription: string
  angle: "front"
}

export type TryOnProviderStartResult = {
  externalJobId: string
  modelVersion: string
}

export type TryOnProviderPollResult =
  | { status: "processing" }
  | { status: "done"; outputUrl: string; latencyMs?: number }
  | { status: "failed"; error: string }

export interface TryOnProvider {
  readonly modelVersion: string
  startPrediction(input: TryOnProviderInput, webhookUrl: string): Promise<TryOnProviderStartResult>
  fetchPrediction(externalJobId: string): Promise<TryOnProviderPollResult>
}

export type TryOnProviderId = "replicate-idm-vton" | "gemini" | "flux"

export function resolveTryOnProviderId(): TryOnProviderId {
  const id = process.env.TRY_ON_PROVIDER?.trim() as TryOnProviderId | undefined
  if (id === "gemini" || id === "flux") return id
  return "replicate-idm-vton"
}

export async function getTryOnProvider(): Promise<TryOnProvider> {
  const id = resolveTryOnProviderId()
  if (id === "replicate-idm-vton") {
    const { replicateIdmVtonProvider } = await import("@/lib/try-on/providers/replicate-idm-vton")
    return replicateIdmVtonProvider
  }
  throw new Error(`Try-on provider "${id}" is not implemented yet. Set TRY_ON_PROVIDER=replicate-idm-vton.`)
}
