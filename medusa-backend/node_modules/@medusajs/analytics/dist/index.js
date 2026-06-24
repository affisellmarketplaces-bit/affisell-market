"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./types");
const utils_1 = require("@medusajs/framework/utils");
const analytics_service_1 = __importDefault(require("./services/analytics-service"));
const providers_1 = __importDefault(require("./loaders/providers"));
exports.default = (0, utils_1.Module)(utils_1.Modules.ANALYTICS, {
    service: analytics_service_1.default,
    loaders: [providers_1.default],
});
//# sourceMappingURL=index.js.map