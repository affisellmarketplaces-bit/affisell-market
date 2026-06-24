import { HttpTypes } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateClaimOutboundItem, HttpTypes.AdminClaimActionsParams>, res: MedusaResponse<HttpTypes.AdminClaimPreviewResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest<{}, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminClaimPreviewResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map