"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminProductRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const http_1 = require("@medusajs/framework/http");
const utils_1 = require("@medusajs/framework/utils");
const multer_1 = __importDefault(require("multer"));
const index_engine_1 = __importDefault(require("../../../feature-flags/index-engine"));
const middlewares_1 = require("../../../utils/middlewares");
const validators_1 = require("../../utils/validators");
const validators_2 = require("../product-variants/validators");
const QueryConfig = __importStar(require("./query-config"));
const query_config_1 = require("./query-config");
const utils_2 = require("./utils");
const validators_3 = require("./validators");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
exports.adminProductRoutesMiddlewares = [
    {
        matcher: "/admin/products/*",
        policies: [
            {
                resource: query_config_1.Entities.product,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        matcher: "/admin/products/*/variants/*",
        policies: [
            {
                resource: query_config_1.Entities.product_variant,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        matcher: "/admin/products/*/options/*",
        policies: [
            {
                resource: query_config_1.Entities.product_option,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        matcher: "/admin/products/*/variants/*/inventory-items/*",
        policies: [
            {
                resource: query_config_1.Entities.inventory_item,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/products",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductsParams, QueryConfig.listProductQueryConfig),
            (req, res, next) => {
                if (utils_1.FeatureFlag.isFeatureEnabled(index_engine_1.default.key)) {
                    return next();
                }
                return (0, http_1.maybeApplyLinkFilter)({
                    entryPoint: "product_sales_channel",
                    resourceId: "product_id",
                    filterableField: "sales_channel_id",
                })(req, res, next);
            },
            (0, utils_2.maybeApplyPriceListsFilter)(),
        ],
        policies: [
            {
                resource: query_config_1.Entities.product,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_3.AdminCreateProduct),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.product,
                operation: utils_1.PolicyOperation.create,
            },
            {
                resource: query_config_1.Entities.inventory_item,
                operation: utils_1.PolicyOperation.create,
            },
            {
                resource: query_config_1.Entities.price,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/batch",
        bodyParser: {
            sizeLimit: middlewares_1.DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
        },
        middlewares: [
            (0, framework_1.validateAndTransformBody)((0, validators_1.createBatchBody)(validators_3.CreateProduct, validators_3.AdminBatchUpdateProduct)),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.product,
                operation: [utils_1.PolicyOperation.create, utils_1.PolicyOperation.update],
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/export",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductsParams, QueryConfig.listProductQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/import",
        middlewares: [upload.single("file")],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/imports",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_3.AdminImportProducts)],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/import/:transaction_id/confirm",
        middlewares: [],
    },
    {
        method: ["GET"],
        matcher: "/admin/products/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/:id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_3.AdminUpdateProduct),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/products/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.product,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/products/:id/variants",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_2.AdminGetProductVariantsParams, QueryConfig.listVariantConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/:id/variants",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_3.AdminCreateProductVariant),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.product_variant,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/:id/variants/batch",
        bodyParser: {
            sizeLimit: middlewares_1.DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
        },
        middlewares: [
            (0, framework_1.validateAndTransformBody)((0, validators_1.createBatchBody)(validators_3.CreateProductVariant, validators_3.AdminBatchUpdateProductVariant)),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductVariantParams, QueryConfig.retrieveVariantConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.product_variant,
                operation: [
                    utils_1.PolicyOperation.create,
                    utils_1.PolicyOperation.update,
                    utils_1.PolicyOperation.delete,
                ],
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/:id/images/:image_id/variants/batch",
        bodyParser: {
            sizeLimit: middlewares_1.DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
        },
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_3.AdminBatchImageVariant)],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/:id/variants/:variant_id/images/batch",
        bodyParser: {
            sizeLimit: middlewares_1.DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
        },
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_3.AdminBatchVariantImages)],
    },
    // Note: New endpoint in v2
    {
        method: ["GET"],
        matcher: "/admin/products/:id/variants/:variant_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductVariantParams, QueryConfig.retrieveVariantConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/:id/variants/:variant_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_3.AdminUpdateProductVariant),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/products/:id/variants/:variant_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.product_variant,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
    // Note: New endpoint in v2
    {
        method: ["GET"],
        matcher: "/admin/products/:id/options",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductOptionsParams, QueryConfig.listOptionConfig),
        ],
    },
    // Note: New endpoint in v2
    {
        method: ["GET"],
        matcher: "/admin/products/:id/options/:option_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductOptionParams, QueryConfig.retrieveOptionConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/:id/options",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_3.AdminCreateProductOption),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/:id/options/:option_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_3.AdminUpdateProductOption),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/products/:id/options/:option_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductParams, QueryConfig.retrieveProductQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.product_option,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
    // Variant inventory item endpoints
    {
        method: ["POST"],
        matcher: "/admin/products/:id/variants/inventory-items/batch",
        bodyParser: {
            sizeLimit: middlewares_1.DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
        },
        middlewares: [
            (0, framework_1.validateAndTransformBody)((0, validators_1.createBatchBody)(validators_3.AdminBatchCreateVariantInventoryItem, validators_3.AdminBatchUpdateVariantInventoryItem, validators_3.AdminBatchDeleteVariantInventoryItem)),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductVariantParams, QueryConfig.retrieveVariantConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.inventory_item,
                operation: [
                    utils_1.PolicyOperation.create,
                    utils_1.PolicyOperation.update,
                    utils_1.PolicyOperation.delete,
                ],
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/:id/variants/:variant_id/inventory-items",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_3.AdminCreateVariantInventoryItem),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductVariantParams, QueryConfig.retrieveVariantConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.inventory_item,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/products/:id/variants/:variant_id/inventory-items/:inventory_item_id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_3.AdminUpdateVariantInventoryItem),
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductVariantParams, QueryConfig.retrieveVariantConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.inventory_item,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/products/:id/variants/:variant_id/inventory-items/:inventory_item_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_3.AdminGetProductVariantParams, QueryConfig.retrieveVariantConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.inventory_item,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
];
//# sourceMappingURL=middlewares.js.map