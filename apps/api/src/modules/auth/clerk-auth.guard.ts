import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { clerkClient } from "@clerk/backend"
import type { Request } from "express"

export type AuthenticatedRequest = Request & {
  auth: { userId: string }
}

/**
 * Verifies Clerk session/JWT from `Authorization: Bearer <token>`.
 * Sets `req.auth.userId` for downstream handlers.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token")
    }

    const token = authHeader.slice("Bearer ".length).trim()
    if (!token) throw new UnauthorizedException("Missing bearer token")

    const session = await clerkClient.verifyToken(token).catch(() => null)
    if (!session?.sub) throw new UnauthorizedException("Invalid Clerk token")

    req.auth = { userId: session.sub }
    return true
  }
}
