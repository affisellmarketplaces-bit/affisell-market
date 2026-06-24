import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetCampaignParams>, res: MedusaResponse<HttpTypes.AdminCampaignResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateCampaign & AdditionalData, HttpTypes.AdminGetCampaignParams>, res: MedusaResponse<HttpTypes.AdminCampaignResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminCampaignDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map