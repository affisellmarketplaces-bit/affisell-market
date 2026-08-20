import { useIdleMount } from "@/hooks/use-idle-mount"

type Options = {
  idleTimeoutMs?: number
  fallbackDelayMs?: number
}

/** Defers optional shell chrome — slightly longer in dev so buyer routes compile first. */
export function useShellIdleMount(options: Options = {}): boolean {
  const isDev = process.env.NODE_ENV === "development"
  const scale = isDev ? 2 : 1
  return useIdleMount({
    idleTimeoutMs: (options.idleTimeoutMs ?? 2800) * scale,
    fallbackDelayMs: (options.fallbackDelayMs ?? 800) * scale,
  })
}
