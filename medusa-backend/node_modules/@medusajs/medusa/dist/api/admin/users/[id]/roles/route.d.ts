import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/types";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetUserRolesParams>, res: MedusaResponse) => Promise<void>;
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminAssignUserRoles>, res: MedusaResponse) => Promise<void>;
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const DELETE: (req: AuthenticatedMedusaRequest<HttpTypes.AdminRemoveUserRoles>, res: MedusaResponse) => Promise<void>;
//# sourceMappingURL=route.d.ts.map