"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: category } = await query.graph({
        entity: "product_category",
        filters: { id: req.params.id, ...req.filterableFields },
        fields: req.queryConfig.fields,
    }, {
        locale: req.locale,
    });
    if (!category) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Product category with id: ${req.params.id} was not found`);
    }
    res.json({ product_category: category[0] });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map