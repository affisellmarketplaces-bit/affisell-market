import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.StoreCustomerAddressFilters>, res: MedusaResponse<HttpTypes.StoreCustomerAddressListResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.StoreCreateCustomerAddress, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.StoreCustomerResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map