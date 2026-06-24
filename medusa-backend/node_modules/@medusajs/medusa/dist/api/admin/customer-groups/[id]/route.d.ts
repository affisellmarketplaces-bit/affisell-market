import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminCustomerGroupResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateCustomerGroup, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminCustomerGroupResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminCustomerGroupDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map