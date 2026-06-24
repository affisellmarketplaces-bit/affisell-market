"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductTranslation = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.ProductTranslation = {
    [utils_1.MEDUSA_SKIP_FILE]: !(utils_1.FeatureFlag.isFeatureEnabled("translation") ||
        process.env.MEDUSA_FF_TRANSLATION === "true"),
    isLink: true,
    isReadOnlyLink: true,
    extends: [
        {
            serviceName: utils_1.Modules.PRODUCT,
            entity: "Product",
            relationship: {
                serviceName: utils_1.Modules.TRANSLATION,
                entity: "Translation",
                primaryKey: "reference_id",
                foreignKey: "id",
                alias: "translations",
                isList: true,
                args: {
                    methodSuffix: "Translations",
                },
            },
        },
        {
            serviceName: utils_1.Modules.PRODUCT,
            entity: "ProductVariant",
            relationship: {
                serviceName: utils_1.Modules.TRANSLATION,
                entity: "Translation",
                primaryKey: "reference_id",
                foreignKey: "id",
                alias: "translations",
                isList: true,
                args: {
                    methodSuffix: "Translations",
                },
            },
        },
        {
            serviceName: utils_1.Modules.PRODUCT,
            entity: "ProductCategory",
            relationship: {
                serviceName: utils_1.Modules.TRANSLATION,
                entity: "Translation",
                primaryKey: "reference_id",
                foreignKey: "id",
                alias: "translations",
                isList: true,
                args: {
                    methodSuffix: "Translations",
                },
            },
        },
        {
            serviceName: utils_1.Modules.PRODUCT,
            entity: "ProductCollection",
            relationship: {
                serviceName: utils_1.Modules.TRANSLATION,
                entity: "Translation",
                primaryKey: "reference_id",
                foreignKey: "id",
                alias: "translations",
                isList: true,
                args: {
                    methodSuffix: "Translations",
                },
            },
        },
        {
            serviceName: utils_1.Modules.PRODUCT,
            entity: "ProductTag",
            relationship: {
                serviceName: utils_1.Modules.TRANSLATION,
                entity: "Translation",
                primaryKey: "reference_id",
                foreignKey: "id",
                alias: "translations",
                isList: true,
                args: {
                    methodSuffix: "Translations",
                },
            },
        },
        {
            serviceName: utils_1.Modules.PRODUCT,
            entity: "ProductType",
            relationship: {
                serviceName: utils_1.Modules.TRANSLATION,
                entity: "Translation",
                primaryKey: "reference_id",
                foreignKey: "id",
                alias: "translations",
                isList: true,
                args: {
                    methodSuffix: "Translations",
                },
            },
        },
        {
            serviceName: utils_1.Modules.PRODUCT,
            entity: "ProductOption",
            relationship: {
                serviceName: utils_1.Modules.TRANSLATION,
                entity: "Translation",
                primaryKey: "reference_id",
                foreignKey: "id",
                alias: "translations",
                isList: true,
                args: {
                    methodSuffix: "Translations",
                },
            },
        },
        {
            serviceName: utils_1.Modules.PRODUCT,
            entity: "ProductOptionValue",
            relationship: {
                serviceName: utils_1.Modules.TRANSLATION,
                entity: "Translation",
                primaryKey: "reference_id",
                foreignKey: "id",
                alias: "translations",
                isList: true,
                args: {
                    methodSuffix: "Translations",
                },
            },
        },
        {
            serviceName: utils_1.Modules.TRANSLATION,
            entity: "Translation",
            relationship: {
                serviceName: utils_1.Modules.PRODUCT,
                entity: "Product",
                primaryKey: "id",
                foreignKey: "reference_id",
                alias: "product",
                args: {
                    methodSuffix: "Products",
                },
            },
        },
    ],
};
//# sourceMappingURL=product-translation.js.map