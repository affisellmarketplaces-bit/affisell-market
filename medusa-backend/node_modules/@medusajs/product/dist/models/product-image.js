"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const product_1 = __importDefault(require("./product"));
const product_variant_1 = __importDefault(require("./product-variant"));
const product_variant_product_image_1 = __importDefault(require("./product-variant-product-image"));
const ProductImage = utils_1.model
    .define({ tableName: "image", name: "ProductImage" }, {
    id: utils_1.model.id({ prefix: "img" }).primaryKey(),
    url: utils_1.model.text(),
    metadata: utils_1.model.json().nullable(),
    rank: utils_1.model.number().default(0),
    product: utils_1.model.belongsTo(() => product_1.default, {
        mappedBy: "images",
    }),
    /**
     * @since 2.11.2
     */
    variants: utils_1.model.manyToMany(() => product_variant_1.default, {
        mappedBy: "images",
        pivotEntity: () => product_variant_product_image_1.default,
    }),
})
    .indexes([
    {
        name: "IDX_product_image_url",
        on: ["url"],
        unique: false,
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_image_rank",
        on: ["rank"],
        unique: false,
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_image_url_rank_product_id",
        on: ["url", "rank", "product_id"],
        unique: false,
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_image_rank_product_id",
        on: ["rank", "product_id"],
        unique: false,
        where: "deleted_at IS NULL",
    },
]);
exports.default = ProductImage;
//# sourceMappingURL=product-image.js.map