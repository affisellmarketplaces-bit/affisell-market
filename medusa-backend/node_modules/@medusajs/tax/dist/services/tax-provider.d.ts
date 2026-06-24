import { DAL, ITaxProvider, Logger, TaxTypes } from "@medusajs/framework/types";
import { ModulesSdkUtils } from "@medusajs/framework/utils";
type InjectedDependencies = {
    logger?: Logger;
    taxProviderRepository: DAL.RepositoryService;
    [key: `tp_${string}`]: ITaxProvider;
};
declare const TaxProviderService_base: {
    new <TContainer extends object = object, TEntity extends object = any>(container: TContainer): import("@medusajs/framework/types").IMedusaInternalService<TEntity, TContainer>;
    setEventSubscriber(subscriber: ModulesSdkUtils.MedusaMikroOrmEventSubscriber): void;
};
export default class TaxProviderService extends TaxProviderService_base {
    #private;
    constructor(container: InjectedDependencies);
    retrieveProvider(providerId: string): ITaxProvider;
    getTaxLines(providerId: string, itemLines: TaxTypes.ItemTaxCalculationLine[], shippingLines: TaxTypes.ShippingTaxCalculationLine[], context: TaxTypes.TaxCalculationContext): Promise<(TaxTypes.ItemTaxLineDTO | TaxTypes.ShippingTaxLineDTO)[]>;
}
export {};
//# sourceMappingURL=tax-provider.d.ts.map