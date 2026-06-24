import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateVariantInventoryItem, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminProductVariantResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest<{}, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminProductVariantInventoryLinkDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map