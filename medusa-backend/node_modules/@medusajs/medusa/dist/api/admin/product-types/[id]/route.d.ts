import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminProductTypeParams>, res: MedusaResponse<HttpTypes.AdminProductTypeResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateProductType, HttpTypes.AdminProductTypeParams>, res: MedusaResponse<HttpTypes.AdminProductTypeResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminProductTypeDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map