import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetCampaignsParams>, res: MedusaResponse<HttpTypes.AdminCampaignListResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateCampaign & AdditionalData, HttpTypes.AdminGetCampaignParams>, res: MedusaResponse<HttpTypes.AdminCampaignResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map