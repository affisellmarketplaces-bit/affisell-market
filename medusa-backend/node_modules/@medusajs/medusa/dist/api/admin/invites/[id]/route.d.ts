import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetInviteParams>, res: MedusaResponse<HttpTypes.AdminInviteResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminInviteDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map