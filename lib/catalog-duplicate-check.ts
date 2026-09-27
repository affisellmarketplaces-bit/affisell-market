import "server-only"

import { prisma } from "@/lib/prisma"

/**
 * Loose duplicate signal: title prefix match OR an exact image URL already tagged on a product.
 * Not a hard block anywhere — callers surface it as a warning the supplier/ops can dismiss.
 */
export async function checkCatalogDuplicate(
  title: string,
  image: string,
  opts?: { scopeSupplierId?: string }
): Promise<boolean> {
  const normalizedTitle = title.trim()
  const normalizedImage = image.trim()
  if (!normalizedTitle && !normalizedImage) return false

  const candidate = await prisma.product.findFirst({
    where: {
      ...(opts?.scopeSupplierId ? { supplierId: opts.scopeSupplierId } : {}),
      OR: [
        ...(normalizedTitle
          ? [
              {
                name: {
                  contains: normalizedTitle.slice(0, 40),
                  mode: "insensitive" as const,
                },
              },
            ]
          : []),
        ...(normalizedImage ? [{ tags: { has: normalizedImage.slice(0, 120) } }] : []),
      ],
    },
    select: { id: true },
  })
  return Boolean(candidate)
}
