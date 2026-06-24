"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const local_analytics_1 = require("./services/local-analytics");
const services = [local_analytics_1.LocalAnalyticsService];
exports.default = (0, utils_1.ModuleProvider)(utils_1.Modules.ANALYTICS, {
    services,
});
//# sourceMappingURL=index.js.map