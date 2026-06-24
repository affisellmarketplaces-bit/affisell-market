import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetRegionParams>, res: MedusaResponse<HttpTypes.AdminRegionResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateRegion, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminRegionResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminRegionDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map