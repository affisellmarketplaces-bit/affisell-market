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
exports.adminFulfillmentProvidersRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const http_1 = require("@medusajs/framework/http");
const utils_1 = require("@medusajs/framework/utils");
const QueryConfig = __importStar(require("./query-config"));
const query_config_1 = require("./query-config");
const validators_1 = require("./validators");
exports.adminFulfillmentProvidersRoutesMiddlewares = [
    {
        matcher: "/admin/fulfillment-providers/*",
        policies: [
            {
                resource: query_config_1.Entities.fulfillment_provider,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/fulfillment-providers",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminFulfillmentProvidersParams, QueryConfig.listTransformQueryConfig),
            (0, http_1.maybeApplyLinkFilter)({
                entryPoint: "location_fulfillment_provider",
                resourceId: "fulfillment_provider_id",
                filterableField: "stock_location_id",
            }),
        ],
        policies: [
            {
                resource: query_config_1.Entities.fulfillment_provider,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/fulfillment-providers/:id/options",
        middlewares: [],
    },
];
//# sourceMappingURL=middlewares.js.map