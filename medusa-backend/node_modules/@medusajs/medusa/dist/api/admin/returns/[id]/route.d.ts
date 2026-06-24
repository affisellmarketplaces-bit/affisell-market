import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminReturnResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateReturnRequest, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminReturnPreviewResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map