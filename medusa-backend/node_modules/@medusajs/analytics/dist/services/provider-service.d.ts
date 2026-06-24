import { Constructor, IAnalyticsProvider, ProviderIdentifyAnalyticsEventDTO, ProviderTrackAnalyticsEventDTO } from "@medusajs/types";
export declare const AnalyticsProviderIdentifierRegistrationName = "analytics_providers_identifier";
export declare const AnalyticsProviderRegistrationPrefix = "aly_";
type InjectedDependencies = {
    [key: `${typeof AnalyticsProviderRegistrationPrefix}${string}`]: IAnalyticsProvider;
};
export default class AnalyticsProviderService {
    protected readonly analyticsProvider_: IAnalyticsProvider;
    constructor(container: InjectedDependencies);
    static getRegistrationIdentifier(providerClass: Constructor<IAnalyticsProvider>, optionName?: string): string;
    track(data: ProviderTrackAnalyticsEventDTO): Promise<void>;
    identify(data: ProviderIdentifyAnalyticsEventDTO): Promise<void>;
    shutdown(): Promise<void>;
}
export {};
//# sourceMappingURL=provider-service.d.ts.map