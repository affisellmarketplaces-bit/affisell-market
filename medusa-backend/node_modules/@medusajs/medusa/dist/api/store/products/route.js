"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const index_engine_1 = __importDefault(require("../../../feature-flags/index-engine"));
const middlewares_1 = require("../../utils/middlewares");
const helpers_1 = require("./helpers");
const GET = async (req, res) => {
    const filterableFields = req.filterableFields;
    if (utils_1.FeatureFlag.isFeatureEnabled(index_engine_1.default.key)) {
        // TODO: These filters are not supported by the index engine yet
        if ((0, utils_1.isPresent)(filterableFields.tags) ||
            (0, utils_1.isPresent)(filterableFields.categories)) {
            return await getProducts(req, res);
        }
        return await getProductsWithIndexEngine(req, res);
    }
    return await getProducts(req, res);
};
exports.GET = GET;
async function getProductsWithIndexEngine(req, res) {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const context = {};
    const withInventoryQuantity = req.queryConfig.fields.some((field) => field.includes("variants.inventory_quantity"));
    if (withInventoryQuantity) {
        req.queryConfig.fields = req.queryConfig.fields.filter((field) => !field.includes("variants.inventory_quantity"));
    }
    if ((0, utils_1.isPresent)(req.pricingContext)) {
        context["variants"] ??= {};
        context["variants"]["calculated_price"] ??= (0, utils_1.QueryContext)(req.pricingContext);
    }
    const filters = req.filterableFields;
    if ((0, utils_1.isPresent)(filters.sales_channel_id)) {
        const salesChannelIds = filters.sales_channel_id;
        filters["sales_channels"] ??= {};
        filters["sales_channels"]["id"] = salesChannelIds;
        delete filters.sales_channel_id;
    }
    // TODO: Remove once we implement search by relations in a similar way to query.graph
    if ((0, utils_1.isPresent)(filters.q)) {
        filters["variants"] ??= {};
    }
    const { data: products = [], metadata } = await query.index({
        entity: "product",
        fields: req.queryConfig.fields,
        filters,
        pagination: req.queryConfig.pagination,
        context,
    }, {
        cache: {
            enable: true,
        },
        locale: req.locale,
    });
    if (withInventoryQuantity) {
        await (0, middlewares_1.wrapVariantsWithInventoryQuantityForSalesChannel)(req, products.map((product) => product.variants).flat(1));
    }
    await (0, helpers_1.wrapProductsWithTaxPrices)(req, products);
    res.json({
        products,
        count: metadata.estimate_count,
        estimate_count: metadata.estimate_count,
        offset: metadata.skip,
        limit: metadata.take,
    });
}
async function getProducts(req, res) {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const context = {};
    const withInventoryQuantity = req.queryConfig.fields.some((field) => field.includes("variants.inventory_quantity"));
    if (withInventoryQuantity) {
        req.queryConfig.fields = req.queryConfig.fields.filter((field) => !field.includes("variants.inventory_quantity"));
    }
    if ((0, utils_1.isPresent)(req.pricingContext)) {
        context["variants"] ??= {};
        context["variants"]["calculated_price"] ??= (0, utils_1.QueryContext)(req.pricingContext);
    }
    const { data: products = [], metadata } = await query.graph({
        entity: "product",
        fields: req.queryConfig.fields,
        filters: req.filterableFields,
        pagination: req.queryConfig.pagination,
        context,
    }, {
        cache: {
            enable: true,
        },
        locale: req.locale,
    });
    if (withInventoryQuantity) {
        await (0, middlewares_1.wrapVariantsWithInventoryQuantityForSalesChannel)(req, products.map((product) => product.variants).flat(1));
    }
    await (0, helpers_1.wrapProductsWithTaxPrices)(req, products);
    res.json({
        products,
        count: metadata.count,
        offset: metadata.skip,
        limit: metadata.take,
    });
}
//# sourceMappingURL=route.js.map