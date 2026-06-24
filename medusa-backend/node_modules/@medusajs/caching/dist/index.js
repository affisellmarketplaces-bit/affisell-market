"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./types");
const utils_1 = require("@medusajs/framework/utils");
const hash_1 = __importDefault(require("./loaders/hash"));
const providers_1 = __importDefault(require("./loaders/providers"));
const cache_module_1 = __importDefault(require("./services/cache-module"));
exports.default = (0, utils_1.Module)(utils_1.Modules.CACHING, {
    service: cache_module_1.default,
    loaders: [hash_1.default, providers_1.default],
});
//# sourceMappingURL=index.js.map