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
exports.adminReservationRoutesMiddlewares = void 0;
const QueryConfig = __importStar(require("./query-config"));
const query_config_1 = require("./query-config");
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const validators_1 = require("./validators");
exports.adminReservationRoutesMiddlewares = [
    {
        matcher: "/admin/reservations/*",
        policies: [
            {
                resource: query_config_1.Entities.reservation_item,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/reservations",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetReservationsParams, QueryConfig.listTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.reservation_item,
                operation: utils_1.PolicyOperation.read,
            },
        ],
    },
    {
        method: ["GET"],
        matcher: "/admin/reservations/:id",
        middlewares: [
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetReservationParams, QueryConfig.retrieveTransformQueryConfig),
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/reservations",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminCreateReservation),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetReservationParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.reservation_item,
                operation: utils_1.PolicyOperation.create,
            },
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/reservations/:id",
        middlewares: [
            (0, framework_1.validateAndTransformBody)(validators_1.AdminUpdateReservation),
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetReservationParams, QueryConfig.retrieveTransformQueryConfig),
        ],
        policies: [
            {
                resource: query_config_1.Entities.reservation_item,
                operation: utils_1.PolicyOperation.update,
            },
        ],
    },
    {
        method: ["DELETE"],
        matcher: "/admin/reservations/:id",
        middlewares: [],
        policies: [
            {
                resource: query_config_1.Entities.reservation_item,
                operation: utils_1.PolicyOperation.delete,
            },
        ],
    },
];
//# sourceMappingURL=middlewares.js.map