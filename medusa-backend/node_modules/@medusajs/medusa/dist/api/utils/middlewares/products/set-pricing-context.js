"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPricingContext = setPricingContext;
const http_1 = require("@medusajs/framework/http");
const utils_1 = require("@medusajs/framework/utils");
const constants_1 = require("./constants");
function setPricingContext(options = {}) {
    const { priceFieldPaths = constants_1.DEFAULT_PRICE_FIELD_PATHS } = options;
    return async (req, _, next) => {
        const withCalculatedPrice = req.queryConfig.fields.some((field) => priceFieldPaths.some((pricePath) => field === pricePath || field.startsWith(`${pricePath}.`)));
        if (!withCalculatedPrice) {
            return next();
        }
        // We validate the region ID in the previous middleware
        const region = await (0, http_1.refetchEntity)({
            entity: "region",
            idOrFilter: req.filterableFields.region_id,
            scope: req.scope,
            fields: ["id", "currency_code"],
            options: {
                cache: {
                    enable: true,
                },
            },
        });
        if (!region) {
            try {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Region with id ${req.filterableFields.region_id} not found when populating the pricing context`);
            }
            catch (e) {
                return next(e);
            }
        }
        const pricingContext = {
            region_id: region.id,
            currency_code: region.currency_code,
        };
        // Find all the customer groups the customer is a part of and set
        if (req.auth_context?.actor_id) {
            const { data: customerGroups } = await (0, http_1.refetchEntities)({
                entity: "customer_group",
                idOrFilter: { customers: { id: req.auth_context.actor_id } },
                scope: req.scope,
                fields: ["id"],
            });
            pricingContext.customer = { groups: [] };
            customerGroups.map((cg) => pricingContext.customer?.groups?.push({ id: cg.id }));
        }
        req.pricingContext = pricingContext;
        return next();
    };
}
//# sourceMappingURL=set-pricing-context.js.map