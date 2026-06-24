import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminReservationParams>, res: MedusaResponse<HttpTypes.AdminReservationResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateReservation, HttpTypes.AdminReservationParams>, res: MedusaResponse<HttpTypes.AdminReservationResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminReservationDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map