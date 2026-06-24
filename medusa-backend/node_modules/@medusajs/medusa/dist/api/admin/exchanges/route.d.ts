import { HttpTypes } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminExchangeListParams>, res: MedusaResponse<HttpTypes.AdminExchangeListResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateExchange, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminExchangeOrderResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map