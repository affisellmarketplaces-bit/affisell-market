"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminShippingProfilesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const query_config_1 = require("./query-config");
const validators_1 = require("./validators");
exports.adminShippingProfilesMiddlewares = [
    {
        matcher: "/admin/shipping-profiles/*",
        policies: [
            {
                resource: query_config_1.Entities.shipping_profile,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/shipping-profiles",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminCreateShippingProfile),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetShippingProfilesParams, query_config_1.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.shipping_profile,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/shipping-profiles",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetShippingProfilesParams, query_config_1.listTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.shipping_profile,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/shipping-profiles/:id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateShippingProfile),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetShippingProfileParams, query_config_1.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.shipping_profile,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/shipping-profiles/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetShippingProfileParams, query_config_1.retrieveTransformQueryConfig),
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/shipping-profiles/:id",
        middlewares: [],
        policies: [
            {
                resource: query_config_1.Entities.shipping_profile,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
];
//# sourceMappingURL=middlewares.js.map