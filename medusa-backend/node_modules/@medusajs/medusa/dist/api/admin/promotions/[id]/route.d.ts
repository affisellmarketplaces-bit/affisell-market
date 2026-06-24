import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetPromotionParams>, res: MedusaResponse<HttpTypes.AdminPromotionResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdatePromotion & AdditionalData, HttpTypes.AdminGetPromotionParams>, res: MedusaResponse<HttpTypes.AdminPromotionResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminPromotionDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map