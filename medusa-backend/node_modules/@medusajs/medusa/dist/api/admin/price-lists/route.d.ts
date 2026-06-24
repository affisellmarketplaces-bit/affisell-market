import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminPriceListListParams>, res: MedusaResponse<HttpTypes.AdminPriceListListResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCreatePriceList, HttpTypes.AdminPriceListListParams>, res: MedusaResponse<HttpTypes.AdminPriceListResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map