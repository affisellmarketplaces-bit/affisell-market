"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsProviderRegistrationPrefix = exports.AnalyticsProviderIdentifierRegistrationName = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.AnalyticsProviderIdentifierRegistrationName = "analytics_providers_identifier";
exports.AnalyticsProviderRegistrationPrefix = "aly_";
class AnalyticsProviderService {
    constructor(container) {
        const analyticsProviderKeys = Object.keys(container).filter((k) => k.startsWith(exports.AnalyticsProviderRegistrationPrefix));
        if (analyticsProviderKeys.length !== 1) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Analytics module should be initialized with exactly one provider`);
        }
        this.analyticsProvider_ = container[analyticsProviderKeys[0]];
    }
    static getRegistrationIdentifier(providerClass, optionName) {
        return `${providerClass.identifier}_${optionName}`;
    }
    async track(data) {
        await this.analyticsProvider_.track(data);
    }
    async identify(data) {
        await this.analyticsProvider_.identify(data);
    }
    async shutdown() {
        await this.analyticsProvider_.shutdown?.();
    }
}
exports.default = AnalyticsProviderService;
//# sourceMappingURL=provider-service.js.map