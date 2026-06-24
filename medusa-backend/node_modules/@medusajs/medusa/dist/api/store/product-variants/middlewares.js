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
exports.storeProductVariantRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const http_1 = require("@medusajs/framework/http");
const utils_1 = require("@medusajs/framework/utils");
const middlewares_1 = require("../../utils/middlewares");
const QueryConfig = __importStar(require("./query-config"));
const validators_1 = require("./validators");
const pricingMiddlewares = [
    (0, middlewares_1.normalizeDataForContext)({ priceFieldPaths: ["calculated_price"] }),
    (0, middlewares_1.setPricingContext)({ priceFieldPaths: ["calculated_price"] }),
    (0, middlewares_1.setTaxContext)({ priceFieldPaths: ["calculated_price"] }),
];
exports.storeProductVariantRoutesMiddlewares = [
    {
        method: ["GET"],
        matcher: "/store/product-variants",
        middlewares: [
            (0, http_1.authenticate)("customer", ["session", "bearer"], {
                allowUnauthenticated: true,
            }),
            (0, framework_1.validateAndTransformQuery)(validators_1.StoreProductVariantListParams, QueryConfig.listProductVariantConfig),
            (0, middlewares_1.filterByValidSalesChannels)(),
            (0, http_1.maybeApplyLinkFilter)({
                entryPoint: "product_sales_channel",
                resourceId: "product_id",
                filterableField: "sales_channel_id",
                filterByField: "product.id",
            }),
            (0, http_1.applyDefaultFilters)({
                product: {
                    status: utils_1.ProductStatus.PUBLISHED,
                },
            }),
            ...pricingMiddlewares,
            (0, http_1.clearFiltersByKey)(["region_id", "country_code", "province", "cart_id"]),
        ],
    },
    {
        method: ["GET"],
        matcher: "/store/product-variants/:id",
        middlewares: [
            (0, http_1.authenticate)("customer", ["session", "bearer"], {
                allowUnauthenticated: true,
            }),
            (0, framework_1.validateAndTransformQuery)(validators_1.StoreProductVariantParams, QueryConfig.retrieveProductVariantConfig),
            (0, http_1.applyParamsAsFilters)({ id: "id" }),
            (0, middlewares_1.filterByValidSalesChannels)(),
            (0, http_1.maybeApplyLinkFilter)({
                entryPoint: "product_sales_channel",
                resourceId: "product_id",
                filterableField: "sales_channel_id",
                filterByField: "product.id",
            }),
            (0, http_1.applyDefaultFilters)({
                product: {
                    status: utils_1.ProductStatus.PUBLISHED,
                },
            }),
            ...pricingMiddlewares,
            (0, http_1.clearFiltersByKey)(["region_id", "country_code", "province", "cart_id"]),
        ],
    },
];
//# sourceMappingURL=middlewares.js.map