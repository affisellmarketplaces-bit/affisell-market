"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const product_category_1 = __importDefault(require("./product-category"));
const product_collection_1 = __importDefault(require("./product-collection"));
const product_image_1 = __importDefault(require("./product-image"));
const product_option_1 = __importDefault(require("./product-option"));
const product_tag_1 = __importDefault(require("./product-tag"));
const product_type_1 = __importDefault(require("./product-type"));
const product_variant_1 = __importDefault(require("./product-variant"));
/**
 * A product in the catalog.
 */
const Product = utils_1.model
    .define("Product", {
    id: utils_1.model.id({ prefix: "prod" }).primaryKey(),
    /**
     * The product's display title.
     */
    title: utils_1.model.text().searchable().translatable(),
    /**
     * The product's unique URL handle.
     */
    handle: utils_1.model.text(),
    /**
     * The product's subtitle.
     */
    subtitle: utils_1.model.text().searchable().translatable().nullable(),
    /**
     * The product's description.
     */
    description: utils_1.model.text().searchable().translatable().nullable(),
    /**
     * Whether the product is a gift card.
     */
    is_giftcard: utils_1.model.boolean().default(false),
    /**
     * The product's status.
     */
    status: utils_1.model
        .enum(utils_1.ProductUtils.ProductStatus)
        .default(utils_1.ProductUtils.ProductStatus.DRAFT),
    /**
     * The product's thumbnail image URL.
     */
    thumbnail: utils_1.model.text().nullable(),
    /**
     * The product's weight.
     */
    weight: utils_1.model.float().nullable(),
    /**
     * The product's length.
     */
    length: utils_1.model.float().nullable(),
    /**
     * The product's height.
     */
    height: utils_1.model.float().nullable(),
    /**
     * The product's width.
     */
    width: utils_1.model.float().nullable(),
    /**
     * The product's country of origin.
     */
    origin_country: utils_1.model.text().nullable(),
    /**
     * The product's Harmonized System code.
     */
    hs_code: utils_1.model.text().nullable(),
    /**
     * The product's MID code.
     */
    mid_code: utils_1.model.text().nullable(),
    /**
     * The product's material.
     */
    material: utils_1.model.text().translatable().nullable(),
    /**
     * Whether the product is eligible for discounts.
     */
    discountable: utils_1.model.boolean().default(true),
    /**
     * The product's external identifier.
     */
    external_id: utils_1.model.text().nullable(),
    /**
     * The product's metadata.
     */
    metadata: utils_1.model.json().nullable(),
    /**
     * The product's variants.
     */
    variants: utils_1.model
        .hasMany(() => product_variant_1.default, {
        mappedBy: "product",
    })
        .searchable(),
    /**
     * The associated product type.
     */
    type: utils_1.model
        .belongsTo(() => product_type_1.default, {
        mappedBy: "products",
    })
        .nullable(),
    /**
     * The associated product tags.
     */
    tags: utils_1.model.manyToMany(() => product_tag_1.default, {
        mappedBy: "products",
        pivotTable: "product_tags",
    }),
    /**
     * The product's options.
     */
    options: utils_1.model.hasMany(() => product_option_1.default, {
        mappedBy: "product",
    }),
    /**
     * The product's images.
     */
    images: utils_1.model.hasMany(() => product_image_1.default, {
        mappedBy: "product",
    }),
    /**
     * The associated product collection.
     */
    collection: utils_1.model
        .belongsTo(() => product_collection_1.default, {
        mappedBy: "products",
    })
        .nullable(),
    /**
     * The associated product categories.
     */
    categories: utils_1.model.manyToMany(() => product_category_1.default, {
        pivotTable: "product_category_product",
        mappedBy: "products",
    }),
})
    .cascades({
    delete: ["variants", "options", "images"],
})
    .indexes([
    {
        name: "IDX_product_handle_unique",
        on: ["handle"],
        unique: true,
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_type_id",
        on: ["type_id"],
        unique: false,
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_collection_id",
        on: ["collection_id"],
        unique: false,
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_status",
        on: ["status"],
        unique: false,
        where: "deleted_at IS NULL",
    },
]);
exports.default = Product;
//# sourceMappingURL=product.js.map