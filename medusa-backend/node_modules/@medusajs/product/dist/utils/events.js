"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBuilders = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.eventBuilders = {
    createdProductCategory: (0, utils_1.moduleEventBuilderFactory)({
        source: utils_1.Modules.PRODUCT,
        action: utils_1.CommonEvents.CREATED,
        object: "product_category",
        eventName: utils_1.ProductEvents.PRODUCT_CATEGORY_CREATED,
    }),
    updatedProductCategory: (0, utils_1.moduleEventBuilderFactory)({
        source: utils_1.Modules.PRODUCT,
        action: utils_1.CommonEvents.UPDATED,
        object: "product_category",
        eventName: utils_1.ProductEvents.PRODUCT_CATEGORY_UPDATED,
    }),
    deletedProductCategory: (0, utils_1.moduleEventBuilderFactory)({
        source: utils_1.Modules.PRODUCT,
        action: utils_1.CommonEvents.DELETED,
        object: "product_category",
        eventName: utils_1.ProductEvents.PRODUCT_CATEGORY_DELETED,
    }),
};
//# sourceMappingURL=events.js.map