import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetProductParams>, res: MedusaResponse<HttpTypes.AdminProductResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateProduct & AdditionalData, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminProductResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminProductDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map