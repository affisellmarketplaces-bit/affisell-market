"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacRolePolicy = exports.RbacRoleParent = exports.RbacRole = exports.RbacPolicy = void 0;
var rbac_policy_1 = require("./rbac-policy");
Object.defineProperty(exports, "RbacPolicy", { enumerable: true, get: function () { return __importDefault(rbac_policy_1).default; } });
var rbac_role_1 = require("./rbac-role");
Object.defineProperty(exports, "RbacRole", { enumerable: true, get: function () { return __importDefault(rbac_role_1).default; } });
var rbac_role_parent_1 = require("./rbac-role-parent");
Object.defineProperty(exports, "RbacRoleParent", { enumerable: true, get: function () { return __importDefault(rbac_role_parent_1).default; } });
var rbac_role_policy_1 = require("./rbac-role-policy");
Object.defineProperty(exports, "RbacRolePolicy", { enumerable: true, get: function () { return __importDefault(rbac_role_policy_1).default; } });
//# sourceMappingURL=index.js.map