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
exports.adminClaimRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const QueryConfig = __importStar(require("./query-config"));
const query_config_1 = require("./query-config");
const validators_1 = require("./validators");
exports.adminClaimRoutesMiddlewares = [
    {
        matcher: "/admin/claims/*",
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/claims",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersParams, QueryConfig.listTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/claims/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostOrderClaimsReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/claim-items",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostClaimItemsReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/claim-items/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostClaimsRequestItemsActionReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/claims/:id/claim-items/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminDeleteClaimItemActionSchema, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/inbound/items",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostClaimsRequestReturnItemsReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/inbound/items/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostClaimsRequestItemsActionReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/claims/:id/inbound/items/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminDeleteClaimItemActionSchema, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/inbound/shipping-method",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostClaimsShippingReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/inbound/shipping-method/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostClaimsShippingActionReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/claims/:id/inbound/shipping-method/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminDeleteClaimItemActionSchema, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/outbound/items",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostClaimsAddItemsReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/outbound/items/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostClaimsRequestItemsActionReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/claims/:id/outbound/items/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminDeleteClaimItemActionSchema, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/outbound/shipping-method",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostClaimsShippingReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/outbound/shipping-method/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostClaimsShippingActionReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/claims/:id/outbound/shipping-method/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminDeleteClaimItemActionSchema, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/request",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/claims/:id/request",
        middlewares: [],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/claims/:id",
        middlewares: [],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/claims/:id/cancel",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminPostCancelClaimReqSchema),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_claim,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
];
//# sourceMappingURL=middlewares.js.map