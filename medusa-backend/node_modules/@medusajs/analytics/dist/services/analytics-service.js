"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
class AnalyticsService {
    constructor({ analyticsProviderService }) {
        this.__hooks = {
            onApplicationShutdown: async () => {
                await this.analyticsProviderService_.shutdown();
            },
        };
        this.analyticsProviderService_ = analyticsProviderService;
    }
    getProvider() {
        return this.analyticsProviderService_;
    }
    async track(data) {
        try {
            await this.analyticsProviderService_.track(data);
        }
        catch (error) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.UNEXPECTED_STATE, `Error tracking event for ${data.event}: ${error.message}`);
        }
    }
    async identify(data) {
        try {
            await this.analyticsProviderService_.identify(data);
        }
        catch (error) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.UNEXPECTED_STATE, `Error identifying event for ${"group" in data ? data.group.id : data.actor_id}: ${error.message}`);
        }
    }
}
exports.default = AnalyticsService;
//# sourceMappingURL=analytics-service.js.map