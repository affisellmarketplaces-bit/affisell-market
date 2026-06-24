import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
/**
 * Returns the authenticated actor's effective permission set as a flat array
 * of `resource:operation` strings, with wildcards already expanded.
 *
 * The "universe" of meaningful permissions is the union of:
 *   - policies registered in code via `definePolicies()` (the global `Policy`
 *     registry), and
 *   - distinct `(resource, operation)` rows currently in `rbac_policy` (covers
 *     policies registered at runtime by admins or plugins).
 *
 * Wildcard-only tuples are excluded — they're grants, not permissions.
 *
 * Clients can rely on literal set membership.
 *
 * @ignore
 * @featureFlag rbac
 */
export declare const GET: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminRbacMePermissionsResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map