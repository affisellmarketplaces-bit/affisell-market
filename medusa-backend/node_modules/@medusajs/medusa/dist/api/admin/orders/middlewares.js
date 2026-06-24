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
exports.adminOrderRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const QueryConfig = __importStar(require("./query-config"));
const query_config_1 = require("./query-config");
const validators_1 = require("./validators");
exports.adminOrderRoutesMiddlewares = [
    {
        matcher: "/admin/orders/*",
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/orders",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersParams, QueryConfig.listTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/orders/export",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersParams, QueryConfig.exportTransformQueryConfig),
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
        matcher: "/admin/orders/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/orders/:id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateOrder),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/orders/:id/line-items",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderItemsParams, QueryConfig.listOrderItemsQueryConfig),
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/orders/:id/shipping-options",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrderShippingOptionList, QueryConfig.listShippingOptionsQueryConfig),
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/orders/:id/changes",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminOrderChangesParams, QueryConfig.retrieveOrderChangesTransformQueryConfig),
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/orders/:id/preview",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/orders/:id/archive",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
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
        matcher: "/admin/orders/:id/cancel",
        middlewares: [
            // validateAndTransformBody(),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
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
        matcher: "/admin/orders/:id/complete",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminCompleteOrder),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
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
        matcher: "/admin/orders/:id/credit-lines",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminCreateOrderCreditLines),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.credit_line,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/orders/:id/fulfillments",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminOrderCreateFulfillment),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.fulfillment,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/cancel",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminOrderCancelFulfillment),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.fulfillment,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/shipments",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminOrderCreateShipment),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.fulfillment,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/mark-as-delivered",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
            (0, framework_1.validateAndTransformBody)(validators_1.AdminMarkOrderFulfillmentAsDelivered),
        ],
        policies: [
            {
                resource: query_config_1.Entities.fulfillment,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/orders/:id/transfer",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminTransferOrder),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
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
        matcher: "/admin/orders/:id/transfer/cancel",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetOrdersOrderParams, QueryConfig.retrieveTransformQueryConfig),
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