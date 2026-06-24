import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: MedusaRequest<HttpTypes.AdminDraftOrderParams>, res: MedusaResponse<HttpTypes.AdminDraftOrderResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateDraftOrder, HttpTypes.AdminDraftOrderParams>, res: MedusaResponse<HttpTypes.AdminDraftOrderResponse>) => Promise<void>;
/**
 * @since 2.8.4
 */
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse) => Promise<void>;
//# sourceMappingURL=route.d.ts.map