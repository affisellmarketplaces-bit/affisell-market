import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.StoreGetCustomerAddressParams>, res: MedusaResponse<HttpTypes.StoreCustomerAddressResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.StoreUpdateCustomerAddress, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.StoreCustomerResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest<{}, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.StoreCustomerAddressDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map