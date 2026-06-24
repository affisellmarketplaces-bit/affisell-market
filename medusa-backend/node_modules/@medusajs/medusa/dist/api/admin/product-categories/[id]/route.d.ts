import { AdminProductCategoryResponse, HttpTypes } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminProductCategoryListParams>, res: MedusaResponse<AdminProductCategoryResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateProductCategory, HttpTypes.AdminProductCategoryParams>, res: MedusaResponse<AdminProductCategoryResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminProductCategoryDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map