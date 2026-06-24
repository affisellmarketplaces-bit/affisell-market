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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeProductRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const http_1 = require("@medusajs/framework/http");
const utils_1 = require("@medusajs/framework/utils");
const index_engine_1 = __importDefault(require("../../../feature-flags/index-engine"));
const middlewares_1 = require("../../utils/middlewares");
const QueryConfig = __importStar(require("./query-config"));
const validators_1 = require("./validators");
async function applyMaybeLinkFilterIfNecessary(req, res, next) {
    const canUseIndex = !((0, utils_1.isPresent)(req.filterableFields.tags) ||
        (0, utils_1.isPresent)(req.filterableFields.categories));
    if (utils_1.FeatureFlag.isFeatureEnabled(index_engine_1.default.key) && canUseIndex) {
        return next();
    }
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const salesChannelsQueryRes = await query.graph({
        entity: "sales_channels",
        fields: ["id"],
        pagination: {
            skip: 0,
            take: 1,
        },
    });
    const salesChannelCount = salesChannelsQueryRes.metadata?.count ?? 0;
    if (!(salesChannelCount > 1)) {
        delete req.filterableFields.sales_channel_id;
        return next();
    }
    return (0, http_1.maybeApplyLinkFilter)({
        entryPoint: "product_sales_channel",
        resourceId: "product_id",
        filterableField: "sales_channel_id",
    })(req, res, next);
}
exports.storeProductRoutesMiddlewares = [
    {
        method: ["GET"],
        matcher: "/store/products",
        middlewares: [
            (0, http_1.authenticate)("customer", ["session", "bearer"], {
                allowUnauthenticated: true,
            }),
            (0, framework_1.validateAndTransformQuery)(validators_1.StoreGetProductsParams, QueryConfig.listProductQueryConfig),
            (0, middlewares_1.filterByValidSalesChannels)(),
            applyMaybeLinkFilterIfNecessary,
            (0, http_1.applyDefaultFilters)({
                status: utils_1.ProductStatus.PUBLISHED,
                // TODO: the type here seems off and the implementation does not take into account $and and $or possible filters. Might be worth re working (original type used here was StoreGetProductsParamsType)
                categories: (filters, fields) => {
                    const categoryIds = filters.category_id;
                    delete filters.category_id;
                    if (!(0, utils_1.isPresent)(categoryIds)) {
                        return;
                    }
                    return { id: categoryIds, is_internal: false, is_active: true };
                },
            }),
            (0, middlewares_1.normalizeDataForContext)(),
            (0, middlewares_1.setPricingContext)(),
            (0, middlewares_1.setTaxContext)(),
            (0, http_1.clearFiltersByKey)(["region_id", "country_code", "province", "cart_id"]),
        ],
    },
    {
        method: ["GET"],
        matcher: "/store/products/:id",
        middlewares: [
            (0, http_1.authenticate)("customer", ["session", "bearer"], {
                allowUnauthenticated: true,
            }),
            (0, framework_1.validateAndTransformQuery)(validators_1.StoreGetProductsParams, QueryConfig.retrieveProductQueryConfig),
            (0, http_1.applyParamsAsFilters)({ id: "id" }),
            (0, middlewares_1.filterByValidSalesChannels)(),
            (0, http_1.maybeApplyLinkFilter)({
                entryPoint: "product_sales_channel",
                resourceId: "product_id",
                filterableField: "sales_channel_id",
            }),
            (0, http_1.applyDefaultFilters)({
                status: utils_1.ProductStatus.PUBLISHED,
            }),
            (0, middlewares_1.normalizeDataForContext)(),
            (0, middlewares_1.setPricingContext)(),
            (0, middlewares_1.setTaxContext)(),
            (0, http_1.clearFiltersByKey)(["region_id", "country_code", "province", "cart_id"]),
        ],
    },
];
//# sourceMappingURL=middlewares.js.map