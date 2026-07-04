import type { Prisma } from "@prisma/client"

/** Prisma JSON column write — storefrontTheme is untyped JSON in schema. */
export function asStorefrontThemeJson(theme: unknown): Prisma.InputJsonValue {
  return theme as Prisma.InputJsonValue
}

export function mergeStorefrontThemeJson(
  base: Prisma.InputJsonValue,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  const obj =
    typeof base === "object" && base !== null && !Array.isArray(base)
      ? (base as Record<string, unknown>)
      : {}
  return asStorefrontThemeJson({ ...obj, ...patch })
}
