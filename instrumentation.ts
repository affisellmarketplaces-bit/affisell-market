export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }
  const { connectPrismaWithRetry } = await import("./lib/prisma")
  await connectPrismaWithRetry()
}
