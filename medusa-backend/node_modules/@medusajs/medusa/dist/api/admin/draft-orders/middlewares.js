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
exports.adminDraftOrderRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const QueryConfig = __importStar(require("./query-config"));
const query_config_1 = require("./query-config");
const validators_1 = require("./validators");
exports.adminDraftOrderRoutesMiddlewares = [
    {
        matcher: "/admin/draft-orders/*",
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/draft-orders",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetDraftOrdersParams, QueryConfig.listTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/draft-orders/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetDraftOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/draft-orders",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminCreateDraftOrder),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetDraftOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/draft-orders/:id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateDraftOrder),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetDraftOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/draft-orders/:id/convert-to-order",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetDraftOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/draft-orders/:id/edit/items",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminAddDraftOrderItems)],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/draft-orders/:id/edit/items/item/:item_id",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateDraftOrderItem)],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/draft-orders/:id/edit/items/:action_id",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateDraftOrderActionItem)],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/draft-orders/:id/edit/promotions",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminAddDraftOrderPromotions)],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/draft-orders/:id/edit/promotions",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminRemoveDraftOrderPromotions)],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/draft-orders/:id/edit/shipping-methods",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminAddDraftOrderShippingMethod)],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/draft-orders/:id/edit/shipping-methods/method/:method_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateDraftOrderShippingMethod),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/draft-orders/:id/edit/shipping-methods/:action_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateDraftOrderActionShippingMethod),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
];
//# sourceMappingURL=middlewares.js.map