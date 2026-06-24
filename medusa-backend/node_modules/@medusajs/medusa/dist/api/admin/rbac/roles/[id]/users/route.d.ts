import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdminAssignRoleUsersType, AdminRemoveRoleUsersType } from "../../validators";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const GET: (req: AuthenticatedMedusaRequest, res: MedusaResponse) => Promise<void>;
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const POST: (req: AuthenticatedMedusaRequest<AdminAssignRoleUsersType>, res: MedusaResponse) => Promise<void>;
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const DELETE: (req: AuthenticatedMedusaRequest<AdminRemoveRoleUsersType>, res: MedusaResponse) => Promise<void>;
//# sourceMappingURL=route.d.ts.map