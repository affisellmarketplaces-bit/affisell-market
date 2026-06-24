import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminProductTagParams>, res: MedusaResponse<HttpTypes.AdminProductTagResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateProductTag, HttpTypes.AdminProductTagParams>, res: MedusaResponse<HttpTypes.AdminProductTagResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminProductTagDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map