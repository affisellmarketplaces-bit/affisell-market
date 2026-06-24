import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdminUpdateRbacPolicyType } from "../validators";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const GET: (req: AuthenticatedMedusaRequest, res: MedusaResponse) => Promise<void>;
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const POST: (req: AuthenticatedMedusaRequest<AdminUpdateRbacPolicyType>, res: MedusaResponse) => Promise<void>;
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse) => Promise<void>;
//# sourceMappingURL=route.d.ts.map