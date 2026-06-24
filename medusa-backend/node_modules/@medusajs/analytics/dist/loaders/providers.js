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
const modules_sdk_1 = require("@medusajs/framework/modules-sdk");
const awilix_1 = require("@medusajs/framework/awilix");
const provider_service_1 = __importStar(require("../services/provider-service"));
const registrationFn = async (klass, container, pluginOptions) => {
    const key = provider_service_1.default.getRegistrationIdentifier(klass, pluginOptions.id);
    container.register({
        [provider_service_1.AnalyticsProviderRegistrationPrefix + key]: (0, awilix_1.asFunction)((cradle) => new klass(cradle, pluginOptions.options ?? {}), {
            lifetime: klass.LIFE_TIME || awilix_1.Lifetime.SINGLETON,
        }),
    });
    container.registerAdd(provider_service_1.AnalyticsProviderIdentifierRegistrationName, (0, awilix_1.asValue)(key));
};
exports.default = async ({ container, options, }) => {
    await (0, modules_sdk_1.moduleProviderLoader)({
        container,
        providers: options?.providers || [],
        registerServiceFn: registrationFn,
    });
};
//# sourceMappingURL=providers.js.map