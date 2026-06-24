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
exports.adminCustomerRoutesMiddlewares = void 0;
const QueryConfig = __importStar(require("./query-config"));
const query_config_1 = require("./query-config");
const validators_1 = require("./validators");
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const validators_2 = require("../../utils/validators");
exports.adminCustomerRoutesMiddlewares = [
    {
        matcher: "/admin/customers/*",
        policies: [
            {
                resource: query_config_1.Entities.customer,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/customers",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminCustomersParams, QueryConfig.listTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.customer,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/customers",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminCreateCustomer),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminCustomerParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.customer,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/customers/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminCustomerParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/customers/:id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateCustomer),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminCustomerParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.customer,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/customers/:id",
        policies: [
            {
                resource: query_config_1.Entities.customer,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/customers/:id/addresses",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminCreateCustomerAddress),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminCustomerParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.customer_address,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/customers/:id/addresses/:address_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminCustomerAddressParams, QueryConfig.retrieveAddressTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.customer_address,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/customers/:id/addresses/:address_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateCustomerAddress),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminCustomerParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.customer_address,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/customers/:id/addresses/:address_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminCustomerParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.customer_address,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/customers/:id/addresses",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminCustomerAddressesParams, QueryConfig.listAddressesTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.customer_address,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/customers/:id/customer-groups",
        middlewares: [
            (0, framework_1.validateAndTransformBody)((0, validators_2.createLinkBody)()),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminCustomerParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.customer,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
];
//# sourceMappingURL=middlewares.js.map