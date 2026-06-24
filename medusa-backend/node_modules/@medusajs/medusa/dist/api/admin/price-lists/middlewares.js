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
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminPriceListsRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const middlewares_1 = require("../../../utils/middlewares");
const validators_1 = require("../../utils/validators");
const QueryConfig = __importStar(require("./query-config"));
const query_config_1 = require("./query-config");
const validators_2 = require("./validators");
exports.adminPriceListsRoutesMiddlewares = [
    {
        matcher: "/admin/price-lists/*",
        policies: [
            {
                resource: query_config_1.Entities.price_list,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        matcher: "/admin/price-lists/*/prices/*",
        policies: [
            {
                resource: query_config_1.Entities.price,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/price-lists",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_2.AdminGetPriceListsParams, QueryConfig.listPriceListQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.price_list,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/price-lists/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_2.AdminGetPriceListParams, QueryConfig.retrivePriceListQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/price-lists",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_2.AdminCreatePriceList),
            (0, framework_1.validateAndTransformQuery)(validators_2.AdminGetPriceListsParams, QueryConfig.retrivePriceListQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.price_list,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/price-lists/:id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_2.AdminUpdatePriceList),
            (0, framework_1.validateAndTransformQuery)(validators_2.AdminGetPriceListParams, QueryConfig.retrivePriceListQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.price_list,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/price-lists/:id/products",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_2.AdminRemoveProductsPriceList),
            (0, framework_1.validateAndTransformQuery)(validators_2.AdminGetPriceListParams, QueryConfig.listPriceListQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.price_list,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/price-lists/:id/prices",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_2.AdminGetPriceListPricesParams, QueryConfig.listPriceListPriceQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/price-lists/:id/prices/batch",
        bodyParser: {
            sizeLimit: middlewares_1.DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
        },
        middlewares: [
            (0, framework_1.validateAndTransformBody)((0, validators_1.createBatchBody)(validators_2.AdminCreatePriceListPrice, validators_2.AdminUpdatePriceListPrice)),
            (0, framework_1.validateAndTransformQuery)(validators_2.AdminGetPriceListPriceParams, QueryConfig.listPriceListPriceQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.price,
                operation: utils_1.PolicyOperation.ALL,
            },
        ],
    },
];
//# sourceMappingURL=middlewares.js.map