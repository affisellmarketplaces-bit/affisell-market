import { NextFunction } from "express";
import { AuthenticatedMedusaRequest } from "@medusajs/framework/http";
type TaxContextOptions = {
    priceFieldPaths?: string[];
};
export declare function setTaxContext(options?: TaxContextOptions): (req: AuthenticatedMedusaRequest, _: any, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=set-tax-context.d.ts.map