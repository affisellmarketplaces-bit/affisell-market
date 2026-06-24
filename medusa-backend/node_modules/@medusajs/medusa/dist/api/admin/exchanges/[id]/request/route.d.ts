import { HttpTypes } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const POST: (req: AuthenticatedMedusaRequest<{}, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminExchangeRequestResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminExchangeDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map