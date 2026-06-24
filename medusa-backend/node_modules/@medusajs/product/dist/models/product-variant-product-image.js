"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const product_variant_1 = __importDefault(require("./product-variant"));
const product_image_1 = __importDefault(require("./product-image"));
/**
 * @since 2.11.2
 */
const ProductVariantProductImage = utils_1.model.define("ProductVariantProductImage", {
    id: utils_1.model.id({ prefix: "pvpi" }).primaryKey(),
    variant: utils_1.model.belongsTo(() => product_variant_1.default, {
        mappedBy: "images",
    }),
    image: utils_1.model.belongsTo(() => product_image_1.default, {
        mappedBy: "variants",
    }),
});
exports.default = ProductVariantProductImage;
//# sourceMappingURL=product-variant-product-image.js.map