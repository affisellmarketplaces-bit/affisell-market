import { TrackAnalyticsEventDTO, IdentifyAnalyticsEventDTO } from "@medusajs/types";
import AnalyticsProviderService from "./provider-service";
type InjectedDependencies = {
    analyticsProviderService: AnalyticsProviderService;
};
export default class AnalyticsService {
    protected readonly analyticsProviderService_: AnalyticsProviderService;
    constructor({ analyticsProviderService }: InjectedDependencies);
    __hooks: {
        onApplicationShutdown: () => Promise<void>;
    };
    getProvider(): AnalyticsProviderService;
    track(data: TrackAnalyticsEventDTO): Promise<void>;
    identify(data: IdentifyAnalyticsEventDTO): Promise<void>;
}
export {};
//# sourceMappingURL=analytics-service.d.ts.map