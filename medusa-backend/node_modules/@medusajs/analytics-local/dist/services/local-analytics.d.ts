import { LocalAnalyticsServiceOptions, Logger, ProviderIdentifyAnalyticsEventDTO, ProviderTrackAnalyticsEventDTO } from "@medusajs/framework/types";
import { AbstractAnalyticsProviderService } from "@medusajs/framework/utils";
type InjectedDependencies = {
    logger: Logger;
};
export declare class LocalAnalyticsService extends AbstractAnalyticsProviderService {
    static identifier: string;
    protected config_: LocalAnalyticsServiceOptions;
    protected logger_: Logger;
    constructor({ logger }: InjectedDependencies, options: LocalAnalyticsServiceOptions);
    track(data: ProviderTrackAnalyticsEventDTO): Promise<void>;
    identify(data: ProviderIdentifyAnalyticsEventDTO): Promise<void>;
}
export {};
//# sourceMappingURL=local-analytics.d.ts.map