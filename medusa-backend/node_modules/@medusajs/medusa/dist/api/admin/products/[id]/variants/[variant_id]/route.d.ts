import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminProductVariantResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateProductVariant & AdditionalData, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminProductResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest<{}, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminProductVariantDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map