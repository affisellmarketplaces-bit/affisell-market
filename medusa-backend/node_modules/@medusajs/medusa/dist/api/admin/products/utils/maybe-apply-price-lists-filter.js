"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeApplyPriceListsFilter = maybeApplyPriceListsFilter;
const utils_1 = require("@medusajs/framework/utils");
const index_engine_1 = __importDefault(require("../../../../feature-flags/index-engine"));
function maybeApplyPriceListsFilter() {
    return async function applyPriceListsFilter(req, _, next) {
        const filterableFields = req.filterableFields;
        if (!filterableFields.price_list_id) {
            return next();
        }
        // When the index engine is enabled and the route handler will use the
        // index path (i.e. no `tags`/`categories` filters that force a fallback),
        // the handler resolves `price_list_id` natively as
        // `variants.prices.price_list_id` against the index. Skip the in-JS
        // variant id expansion in that case.
        if (utils_1.FeatureFlag.isFeatureEnabled(index_engine_1.default.key) &&
            !filterableFields.tags &&
            !filterableFields.categories) {
            return next();
        }
        const priceListIds = filterableFields.price_list_id;
        delete filterableFields.price_list_id;
        // Query the `price` entry point directly with a `price_list_id` filter
        // instead of `price_list` with a wide `prices.price_set.variant.id`
        // expansion. The latter forces the remote joiner to hydrate every price
        // and price-set on the price list before we can extract variant ids — a
        // significant overhead on large price lists (thousands of prices).
        const queryObject = (0, utils_1.remoteQueryObjectFromString)({
            entryPoint: "price",
            fields: ["price_set.variant.id"],
            variables: {
                filters: { price_list_id: priceListIds },
            },
        });
        const remoteQuery = req.scope.resolve(utils_1.ContainerRegistrationKeys.REMOTE_QUERY);
        const prices = await remoteQuery(queryObject);
        const variantIds = new Set();
        for (const price of prices) {
            const variantId = price.price_set?.variant?.id;
            if (variantId) {
                variantIds.add(variantId);
            }
        }
        filterableFields.variants = {
            ...(filterableFields.variants ?? {}),
            id: Array.from(variantIds),
        };
        return next();
    };
}
//# sourceMappingURL=maybe-apply-price-lists-filter.js.map