import { AdminFulfillmentSetResponse, AdminServiceZoneResponse, HttpTypes } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminServiceZonesParams>, res: MedusaResponse<AdminServiceZoneResponse>) => Promise<void>;
export declare const POST: (req: MedusaRequest<HttpTypes.AdminUpdateFulfillmentSetServiceZone, HttpTypes.AdminServiceZonesParams>, res: MedusaResponse<AdminFulfillmentSetResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminServiceZoneDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map