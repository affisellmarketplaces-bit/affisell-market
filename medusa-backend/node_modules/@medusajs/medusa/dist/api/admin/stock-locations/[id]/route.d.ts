import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateStockLocation, HttpTypes.AdminGetStockLocationParams>, res: MedusaResponse<HttpTypes.AdminStockLocationResponse>) => Promise<void>;
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetStockLocationParams>, res: MedusaResponse<HttpTypes.AdminStockLocationResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminStockLocationDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map