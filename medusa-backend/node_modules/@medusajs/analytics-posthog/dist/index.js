"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const posthog_analytics_1 = require("./services/posthog-analytics");
const services = [posthog_analytics_1.PosthogAnalyticsService];
exports.default = (0, utils_1.ModuleProvider)(utils_1.Modules.ANALYTICS, {
    services,
});
//# sourceMappingURL=index.js.map