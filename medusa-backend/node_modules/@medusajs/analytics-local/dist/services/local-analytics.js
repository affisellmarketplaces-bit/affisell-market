"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalAnalyticsService = void 0;
const utils_1 = require("@medusajs/framework/utils");
class LocalAnalyticsService extends utils_1.AbstractAnalyticsProviderService {
    constructor({ logger }, options) {
        super();
        this.config_ = options;
        this.logger_ = logger;
    }
    async track(data) {
        this.logger_.debug(`Tracking event: '${data.event}', actor_id: '${data.actor_id ?? "-"}', group: '${data.group?.id ?? "-"}', properties: '${JSON.stringify(data.properties)}'`);
    }
    async identify(data) {
        this.logger_.debug(`Identifying user: '${data.actor_id ?? "-"}', group: '${"group" in data ? data.group.id : "-"}', properties: '${JSON.stringify(data.properties)}'`);
    }
}
exports.LocalAnalyticsService = LocalAnalyticsService;
LocalAnalyticsService.identifier = "analytics-local";
//# sourceMappingURL=local-analytics.js.map