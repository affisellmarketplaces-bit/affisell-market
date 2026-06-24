"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _a, _ProductRepository_getProductDeepUpdateRelationsToLoad;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductRepository = void 0;
const _models_1 = require("../models");
const utils_1 = require("@medusajs/framework/utils");
const postgresql_1 = require("@medusajs/framework/mikro-orm/postgresql");
class ProductRepository extends utils_1.DALUtils.mikroOrmBaseRepositoryFactory(_models_1.Product) {
    constructor(...args) {
        // @ts-ignore
        super(...arguments);
    }
    async deepUpdate(productsToUpdate, validateVariantOptions, context = {}) {
        const productsToUpdate_ = (0, utils_1.deepCopy)(productsToUpdate);
        const productIdsToUpdate = [];
        productsToUpdate_.forEach((productToUpdate) => {
            productIdsToUpdate.push(productToUpdate.id);
        });
        const relationsToLoad = __classPrivateFieldGet(_a, _a, "m", _ProductRepository_getProductDeepUpdateRelationsToLoad).call(_a, productsToUpdate_);
        const findOptions = (0, utils_1.buildQuery)({ id: productIdsToUpdate }, {
            relations: relationsToLoad,
            take: productsToUpdate_.length,
        });
        const products = await this.find(findOptions, context);
        const productsMap = new Map(products.map((p) => [p.id, p]));
        const productIds = Array.from(productsMap.keys());
        const productsNotFound = (0, utils_1.arrayDifference)(productIdsToUpdate, productIds);
        if (productsNotFound.length > 0) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Unable to update the products with ids: ${productsNotFound.join(", ")}`);
        }
        for (const productToUpdate of productsToUpdate_) {
            const product = productsMap.get(productToUpdate.id);
            const wrappedProduct = (0, postgresql_1.wrap)(product);
            // Assign the options first, so they'll be available for the variants loop below
            if (productToUpdate.options) {
                wrappedProduct.assign({ options: productToUpdate.options });
                delete productToUpdate.options; // already assigned above, so no longer necessary
            }
            if (productToUpdate.variants) {
                validateVariantOptions(productToUpdate.variants, product.options);
                productToUpdate.variants.forEach((variant) => {
                    if (variant.options) {
                        variant.options = Object.entries(variant.options).map(([key, value]) => {
                            const productOption = product.options.find((option) => option.title === key);
                            const productOptionValue = productOption.values?.find((optionValue) => optionValue.value === value);
                            return productOptionValue.id;
                        });
                    }
                });
            }
            if (productToUpdate.tags) {
                productToUpdate.tags = productToUpdate.tags.map((t) => t.id);
            }
            if (productToUpdate.categories) {
                productToUpdate.categories = productToUpdate.categories.map((c) => c.id);
            }
            if (productToUpdate.images) {
                productToUpdate.images = productToUpdate.images.map((image, index) => ({
                    ...image,
                    rank: index,
                }));
            }
            if ((0, utils_1.isPresent)(productToUpdate.metadata)) {
                productToUpdate.metadata = (0, utils_1.mergeMetadata)(product.metadata ?? {}, productToUpdate.metadata);
            }
            wrappedProduct.assign(productToUpdate);
        }
        // Doing this to ensure updates are returned in the same order they were provided,
        // since some core flows rely on this.
        // This is a high level of coupling though.
        return productsToUpdate_.map((productToUpdate) => productsMap.get(productToUpdate.id));
    }
    /**
     * In order to be able to have a strict not in categories, and prevent a product
     * to be return in the case it also belongs to other categories, we need to
     * first find all products that are in the categories, and then exclude them
     */
    async mutateNotInCategoriesConstraints(findOptions = {
        where: {},
    }, context = {}) {
        const manager = this.getActiveManager(context);
        if ("categories" in findOptions.where &&
            findOptions.where.categories?.id?.["$nin"]) {
            const productsInCategories = await manager.find(this.entity, {
                categories: {
                    id: { $in: findOptions.where.categories.id["$nin"] },
                },
            }, {
                fields: ["id"],
            });
            const productIds = productsInCategories.map((product) => product.id);
            if (productIds.length) {
                findOptions.where.id = { $nin: productIds };
                delete findOptions.where.categories?.id;
                if (Object.keys(findOptions.where.categories).length === 0) {
                    delete findOptions.where.categories;
                }
            }
        }
    }
}
exports.ProductRepository = ProductRepository;
_a = ProductRepository, _ProductRepository_getProductDeepUpdateRelationsToLoad = function _ProductRepository_getProductDeepUpdateRelationsToLoad(productsToUpdate) {
    const relationsToLoad = new Set();
    productsToUpdate.forEach((productToUpdate) => {
        if (productToUpdate.options) {
            relationsToLoad.add("options");
            relationsToLoad.add("options.values");
        }
        if (productToUpdate.variants) {
            relationsToLoad.add("options");
            relationsToLoad.add("options.values");
            relationsToLoad.add("variants");
            relationsToLoad.add("variants.options");
            relationsToLoad.add("variants.options.option");
        }
        if (productToUpdate.tags)
            relationsToLoad.add("tags");
        if (productToUpdate.categories)
            relationsToLoad.add("categories");
        if (productToUpdate.images)
            relationsToLoad.add("images");
        if (productToUpdate.collection)
            relationsToLoad.add("collection");
        if (productToUpdate.type)
            relationsToLoad.add("type");
    });
    return Array.from(relationsToLoad);
};
//# sourceMappingURL=product.js.map