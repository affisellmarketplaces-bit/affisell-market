import { Constructor, ICachingProviderService, Logger } from "@medusajs/framework/types";
type InjectedDependencies = {
    [key: `cp_${string}`]: ICachingProviderService;
    logger?: Logger;
};
export default class CacheProviderService {
    #private;
    constructor(container: InjectedDependencies);
    static getRegistrationIdentifier(providerClass: Constructor<ICachingProviderService>): string;
    retrieveProvider(providerId: string): ICachingProviderService;
}
export {};
//# sourceMappingURL=cache-provider.d.ts.map