import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { clerkClient } from "@clerk/backend"

/**
 * Minimal Clerk guard:
 * - Expects `Authorization: Bearer <Clerk JWT>` (or session token)
 * - Verifies token with Clerk backend
 *
 * NOTE: Keep it intentionally small for V1 infra; extend with role/plan checks later.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { auth?: { userId: string } }>()
    const authHeader = (req.headers as any)?.authorization as string | undefined
    if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedException("Missing bearer token")
    const token = authHeader.slice("Bearer ".length).trim()
    if (!token) throw new UnauthorizedException("Missing bearer token")

    // Clerk backend reads CLERK_SECRET_KEY from env.
    const session = await clerkClient.verifyToken(token).catch(() => null)
    if (!session?.sub) throw new UnauthorizedException("Invalid Clerk token")
    req.auth = { userId: session.sub }
    ;(req as any).clerkUserId = session.sub
    return true
  }
}

