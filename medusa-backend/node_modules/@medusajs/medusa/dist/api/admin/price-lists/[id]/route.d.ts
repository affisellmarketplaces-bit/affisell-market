import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminPriceListParams>, res: MedusaResponse<HttpTypes.AdminPriceListResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdatePriceList, HttpTypes.AdminPriceListParams>, res: MedusaResponse<HttpTypes.AdminPriceListResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminPriceListDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map