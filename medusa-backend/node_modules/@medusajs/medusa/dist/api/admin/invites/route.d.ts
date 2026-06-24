import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetInvitesParams>, res: MedusaResponse<HttpTypes.AdminInviteListResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateInvite, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminInviteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map