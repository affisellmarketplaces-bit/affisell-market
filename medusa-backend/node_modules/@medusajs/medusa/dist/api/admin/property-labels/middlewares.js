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
exports.adminPropertyLabelsMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const middleware_1 = require("../views/[entity]/configurations/middleware");
const QueryConfig = __importStar(require("./query-config"));
const validators_1 = require("./validators");
exports.adminPropertyLabelsMiddlewares = [
    // List property labels
    {
        matcher: "/admin/property-labels",
        method: "GET",
        middlewares: [
            middleware_1.ensureViewConfigurationsEnabled,
            (0, http_1.validateAndTransformQuery)(validators_1.AdminPropertyLabelListParams, QueryConfig.listTransformQueryConfig),
        ],
    },
    // Create property label
    {
        matcher: "/admin/property-labels",
        method: "POST",
        middlewares: [
            middleware_1.ensureViewConfigurationsEnabled,
            (0, http_1.validateAndTransformBody)(validators_1.AdminCreatePropertyLabel),
            (0, http_1.validateAndTransformQuery)(validators_1.AdminPropertyLabelParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    // Get single property label
    {
        matcher: "/admin/property-labels/:id",
        method: "GET",
        middlewares: [
            middleware_1.ensureViewConfigurationsEnabled,
            (0, http_1.validateAndTransformQuery)(validators_1.AdminPropertyLabelParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    // Update property label
    {
        matcher: "/admin/property-labels/:id",
        method: "POST",
        middlewares: [
            middleware_1.ensureViewConfigurationsEnabled,
            (0, http_1.validateAndTransformBody)(validators_1.AdminUpdatePropertyLabel),
            (0, http_1.validateAndTransformQuery)(validators_1.AdminPropertyLabelParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    // Delete property label
    {
        matcher: "/admin/property-labels/:id",
        method: "DELETE",
        middlewares: [middleware_1.ensureViewConfigurationsEnabled],
    },
    // Batch operations
    {
        matcher: "/admin/property-labels/batch",
        method: "POST",
        middlewares: [
            middleware_1.ensureViewConfigurationsEnabled,
            (0, http_1.validateAndTransformBody)(validators_1.AdminBatchPropertyLabels),
            (0, http_1.validateAndTransformQuery)(validators_1.AdminPropertyLabelParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
];
//# sourceMappingURL=middlewares.js.map