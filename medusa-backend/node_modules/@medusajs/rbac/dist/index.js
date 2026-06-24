"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const _services_1 = require("./services");
const initial_data_1 = __importDefault(require("./loaders/initial-data"));
exports.default = (0, utils_1.Module)(utils_1.Modules.RBAC, {
    service: _services_1.RbacModuleService,
    loaders: [initial_data_1.default],
});
//# sourceMappingURL=index.js.map