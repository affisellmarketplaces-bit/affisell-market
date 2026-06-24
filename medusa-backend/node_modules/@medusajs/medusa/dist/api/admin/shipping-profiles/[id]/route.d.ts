import { HttpTypes } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetShippingProfileParams>, res: MedusaResponse<HttpTypes.AdminShippingProfileResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminShippingProfileDeleteResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateShippingProfile, HttpTypes.AdminGetShippingProfileParams>, res: MedusaResponse<HttpTypes.AdminShippingProfileResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map