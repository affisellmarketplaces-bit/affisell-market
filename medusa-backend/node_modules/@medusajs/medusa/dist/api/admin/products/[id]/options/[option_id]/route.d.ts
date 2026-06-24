import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminProductOptionResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateProductOption & AdditionalData, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminProductResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest<{}, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminProductOptionDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map