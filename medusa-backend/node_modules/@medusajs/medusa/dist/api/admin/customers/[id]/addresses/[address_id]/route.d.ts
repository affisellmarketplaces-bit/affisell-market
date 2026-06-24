import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdminCreateCustomerAddressType } from "../../../validators";
import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCustomerAddressParams>, res: MedusaResponse<HttpTypes.AdminCustomerAddressResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<AdminCreateCustomerAddressType & AdditionalData, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminCustomerResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest<{}, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminCustomerAddressDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map