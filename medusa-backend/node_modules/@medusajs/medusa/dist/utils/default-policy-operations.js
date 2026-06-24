"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultPolicyOperations = void 0;
const utils_1 = require("@medusajs/framework/utils");
// Default operations for all resources
exports.defaultPolicyOperations = Object.keys(utils_1.PolicyOperation).filter((key) => key !== "ALL" && key !== utils_1.WILDCARD);
//# sourceMappingURL=default-policy-operations.js.map