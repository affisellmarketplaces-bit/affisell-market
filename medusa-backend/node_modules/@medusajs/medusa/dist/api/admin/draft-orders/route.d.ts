import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: MedusaRequest<HttpTypes.AdminDraftOrderListParams>, res: MedusaResponse<HttpTypes.AdminDraftOrderListResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateDraftOrder & AdditionalData, HttpTypes.AdminDraftOrderParams>, res: MedusaResponse<HttpTypes.AdminDraftOrderResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map