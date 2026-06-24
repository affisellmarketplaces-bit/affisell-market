import { HttpTypes } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateExchangeOutboundItem, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminExchangePreviewResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest<{}, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminExchangePreviewResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map