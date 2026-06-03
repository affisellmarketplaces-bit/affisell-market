import { Prisma } from "@prisma/client"

function prismaErrorCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code
    return typeof code === "string" ? code : null
  }
  return null
}

function prismaErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function prismaMissingColumnName(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as { column?: string } | undefined
    return typeof meta?.column === "string" ? meta.column : null
  }
  if (typeof error === "object" && error !== null && "meta" in error) {
    const meta = (error as { meta?: { column?: string } }).meta
    return typeof meta?.column === "string" ? meta.column : null
  }
  return null
}

/** Prisma P2022 — column missing (migration not yet applied on this database). */
export function isPrismaMissingColumnError(
  error: unknown,
  column?: string
): boolean {
  if (prismaErrorCode(error) !== "P2022") {
    if (!column) return false
    return prismaErrorMessage(error).includes(column)
  }
  if (!column) return true
  const col = prismaMissingColumnName(error)
  if (col?.includes(column)) return true
  return prismaErrorMessage(error).includes(column)
}
