import { HttpTypes } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetShippingOptionParams>, res: MedusaResponse<HttpTypes.AdminShippingOptionResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateShippingOption, HttpTypes.AdminGetShippingOptionParams>, res: MedusaResponse<HttpTypes.AdminShippingOptionResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminShippingOptionDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map