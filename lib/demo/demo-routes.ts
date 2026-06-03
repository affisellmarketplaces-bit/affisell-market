import { barePathname } from "@/lib/mobile-chrome"

import { DEMO_PERSONAS, type DemoPersonaKey } from "@/lib/demo/demo-shared"

export function isDemoLabRoute(pathname: string): boolean {
  return barePathname(pathname).startsWith("/demo")
}

export function isDemoPersonaKey(value: string): value is DemoPersonaKey {
  return (DEMO_PERSONAS as readonly string[]).includes(value)
}
