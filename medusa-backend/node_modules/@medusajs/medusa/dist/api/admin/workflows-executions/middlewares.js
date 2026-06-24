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
exports.adminWorkflowsExecutionsMiddlewares = void 0;
const QueryConfig = __importStar(require("./query-config"));
const query_config_1 = require("./query-config");
const validators_1 = require("./validators");
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
exports.adminWorkflowsExecutionsMiddlewares = [
    {
        matcher: "/admin/workflows-executions/*",
        policies: [
            {
                resource: query_config_1.Entities.workflow_execution,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/workflows-executions",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetWorkflowExecutionsParams, QueryConfig.listTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.workflow_execution,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/workflows-executions/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetWorkflowExecutionDetailsParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/workflows-executions/:workflow_id/:transaction_id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetWorkflowExecutionDetailsParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/workflows-executions/:workflow_id/run",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminCreateWorkflowsRun)],
    },
    {
        method: ["POST"],
        matcher: "/admin/workflows-executions/:workflow_id/steps/success",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminCreateWorkflowsAsyncResponse)],
    },
    {
        method: ["POST"],
        matcher: "/admin/workflows-executions/:workflow_id/steps/failure",
        middlewares: [(0, framework_1.validateAndTransformBody)(validators_1.AdminCreateWorkflowsAsyncResponse)],
    },
];
//# sourceMappingURL=middlewares.js.map