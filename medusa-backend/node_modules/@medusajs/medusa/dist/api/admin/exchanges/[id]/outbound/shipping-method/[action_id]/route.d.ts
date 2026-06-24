import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminExchangeUpdateOutboundShipping, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminExchangePreviewResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest<{}, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminExchangePreviewResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map