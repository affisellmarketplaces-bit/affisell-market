import { HttpTypes } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminInitiateReceiveReturn, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminOrderReturnResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminReturnDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map