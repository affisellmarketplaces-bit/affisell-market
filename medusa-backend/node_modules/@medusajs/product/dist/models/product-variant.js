"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const _models_1 = require(".");
const product_variant_product_image_1 = __importDefault(require("./product-variant-product-image"));
const ProductVariant = utils_1.model
    .define("ProductVariant", {
    id: utils_1.model.id({ prefix: "variant" }).primaryKey(),
    title: utils_1.model.text().searchable().translatable(),
    sku: utils_1.model.text().searchable().nullable(),
    barcode: utils_1.model.text().searchable().nullable(),
    ean: utils_1.model.text().searchable().nullable(),
    upc: utils_1.model.text().searchable().nullable(),
    allow_backorder: utils_1.model.boolean().default(false),
    manage_inventory: utils_1.model.boolean().default(true),
    hs_code: utils_1.model.text().nullable(),
    origin_country: utils_1.model.text().nullable(),
    mid_code: utils_1.model.text().nullable(),
    material: utils_1.model.text().translatable().nullable(),
    weight: utils_1.model.float().nullable(),
    length: utils_1.model.float().nullable(),
    height: utils_1.model.float().nullable(),
    width: utils_1.model.float().nullable(),
    metadata: utils_1.model.json().nullable(),
    variant_rank: utils_1.model.number().default(0).nullable(),
    /**
     * @since 2.11.2
     */
    thumbnail: utils_1.model.text().nullable(),
    product: utils_1.model
        .belongsTo(() => _models_1.Product, {
        mappedBy: "variants",
    })
        .searchable()
        .nullable(),
    /**
     * @since 2.11.2
     */
    images: utils_1.model.manyToMany(() => _models_1.ProductImage, {
        mappedBy: "variants",
        pivotEntity: () => product_variant_product_image_1.default,
    }),
    options: utils_1.model.manyToMany(() => _models_1.ProductOptionValue, {
        pivotTable: "product_variant_option",
        mappedBy: "variants",
        joinColumn: "variant_id",
        inverseJoinColumn: "option_value_id",
    }),
})
    .indexes([
    {
        name: "IDX_product_variant_id_product_id",
        on: ["id", "product_id"],
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_variant_product_id",
        on: ["product_id"],
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_variant_sku_unique",
        on: ["sku"],
        unique: true,
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_variant_barcode_unique",
        on: ["barcode"],
        unique: true,
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_variant_ean_unique",
        on: ["ean"],
        unique: true,
        where: "deleted_at IS NULL",
    },
    {
        name: "IDX_product_variant_upc_unique",
        on: ["upc"],
        unique: true,
        where: "deleted_at IS NULL",
    },
]);
exports.default = ProductVariant;
//# sourceMappingURL=product-variant.js.map