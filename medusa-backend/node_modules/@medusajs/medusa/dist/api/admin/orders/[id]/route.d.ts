import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetOrderDetailsParams>, res: MedusaResponse<HttpTypes.AdminOrderResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateOrder, HttpTypes.AdminGetOrderDetailsParams>, res: MedusaResponse<HttpTypes.AdminOrderResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map