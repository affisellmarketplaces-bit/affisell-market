"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUserRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const QueryConfig = __importStar(require("./query-config"));
const query_config_1 = require("./query-config");
const validators_1 = require("./validators");
exports.adminUserRoutesMiddlewares = [
    {
        method: ["GET"],
        matcher: "/admin/users",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetUsersParams, QueryConfig.listTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.user,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/users/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetUserParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.user,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/users/me",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetUserParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/users/:id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateUser),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetUserParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.user,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/users/:id",
        policies: [
            {
                resource: query_config_1.Entities.user,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/users/:id/roles",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetUserRolesParams, QueryConfig.listUserRolesTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.user,
                operation: utils_1.PolicyOperation.read,
            },
            {
                resource: query_config_1.Entities.rbac_role,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/users/:id/roles",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminAssignUserRoles)],
        policies: [
            {
                resource: query_config_1.Entities.user,
                operation: utils_1.PolicyOperation.update,
            },
            {
                resource: query_config_1.Entities.rbac_role,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/users/:id/roles/:role_id",
        policies: [
            {
                resource: query_config_1.Entities.user,
                operation: utils_1.PolicyOperation.update,
            },
            {
                resource: query_config_1.Entities.rbac_role,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/users/:id/roles",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminRemoveUserRoles)],
        policies: [
            {
                resource: query_config_1.Entities.user,
                operation: utils_1.PolicyOperation.update,
            },
            {
                resource: query_config_1.Entities.rbac_role,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
];
//# sourceMappingURL=middlewares.js.map