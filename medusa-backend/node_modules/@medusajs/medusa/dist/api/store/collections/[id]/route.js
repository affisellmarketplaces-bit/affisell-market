"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: collections } = await query.graph({
        entity: "product_collection",
        filters: { id: req.params.id },
        fields: req.queryConfig.fields,
    }, {
        locale: req.locale,
    });
    const collection = collections[0];
    if (!collection) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Collection with id: ${req.params.id} was not found`);
    }
    res.status(200).json({ collection: collection });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map