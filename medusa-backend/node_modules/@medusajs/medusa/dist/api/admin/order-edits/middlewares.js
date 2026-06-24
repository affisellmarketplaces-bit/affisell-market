"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOrderEditRoutesMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const utils_1 = require("@medusajs/framework/utils");
const query_config_1 = require("./query-config");
const validators_1 = require("./validators");
exports.adminOrderEditRoutesMiddlewares = [
    {
        matcher: "/admin/order-edits/*",
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/order-edits/:id",
        middlewares: [],
    },
    {
        method: ["POST"],
        matcher: "/admin/order-edits",
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.AdminPostOrderEditsReqSchema)],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/order-edits/:id/items",
        middlewares: [
            (0, http_1.validateAndTransformBody)(validators_1.AdminPostOrderEditsAddItemsReqSchema),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/order-edits/:id/items/:action_id",
        middlewares: [
            (0, http_1.validateAndTransformBody)(validators_1.AdminPostOrderEditsItemsActionReqSchema),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/order-edits/:id/items/item/:item_id",
        middlewares: [
            (0, http_1.validateAndTransformBody)(validators_1.AdminPostOrderEditsUpdateItemQuantityReqSchema),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/order-edits/:id/items/:action_id",
        middlewares: [],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/order-edits/:id/shipping-method",
        middlewares: [
            (0, http_1.validateAndTransformBody)(validators_1.AdminPostOrderEditsShippingReqSchema),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/order-edits/:id/shipping-method/:action_id",
        middlewares: [
            (0, http_1.validateAndTransformBody)(validators_1.AdminPostOrderEditsShippingActionReqSchema),
        ],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/order-edits/:id/shipping-method/:action_id",
        middlewares: [],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/order-edits/:id/confirm",
        middlewares: [],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/order-edits/:id/request",
        middlewares: [],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/order-edits/:id",
        middlewares: [],
        policies: [
            {
                resource: query_config_1.Entities.order_change,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
];
//# sourceMappingURL=middlewares.js.map