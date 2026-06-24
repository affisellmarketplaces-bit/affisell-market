import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateReturnShipping, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminReturnPreviewResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest<{}, HttpTypes.AdminReturnFilters>, res: MedusaResponse<HttpTypes.AdminReturnPreviewResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map