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
const awilix_1 = require("@medusajs/framework/awilix");
const modules_sdk_1 = require("@medusajs/framework/modules-sdk");
const utils_1 = require("@medusajs/framework/utils");
const providers = __importStar(require("../providers"));
const PROVIDER_REGISTRATION_KEY = "payment_providers";
const registrationFn = async (klass, container, pluginOptions) => {
    if (!klass?.identifier) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_ARGUMENT, `Trying to register a payment provider without a provider identifier.`);
    }
    const key = `pp_${klass.identifier}${pluginOptions.id ? `_${pluginOptions.id}` : ""}`;
    container.register({
        [key]: (0, awilix_1.asFunction)((cradle) => new klass(cradle, pluginOptions.options), {
            lifetime: klass.LIFE_TIME || awilix_1.Lifetime.SINGLETON,
        }),
    });
    container.registerAdd(PROVIDER_REGISTRATION_KEY, (0, awilix_1.asValue)(key));
};
exports.default = async ({ container, options, }) => {
    await registrationFn(providers.SystemPaymentProvider, container, {
        id: "default",
    });
    // We only want to register medusa payments if the options for it have been provided.
    const { api_key, endpoint, environment_handle, sandbox_handle, webhook_secret, } = options?.cloud ?? {};
    if (api_key &&
        endpoint &&
        webhook_secret &&
        (environment_handle || sandbox_handle)) {
        await registrationFn(providers.MedusaPaymentsProvider, container, {
            options: {
                api_key,
                endpoint,
                environment_handle,
                sandbox_handle,
                webhook_secret,
            },
            id: "default",
        });
    }
    await (0, modules_sdk_1.moduleProviderLoader)({
        container,
        providers: options?.providers || [],
        registerServiceFn: registrationFn,
    });
    await registerProvidersInDb({ container });
};
const registerProvidersInDb = async ({ container, }) => {
    const providersToLoad = container.resolve(PROVIDER_REGISTRATION_KEY);
    const paymentProviderService = container.resolve("paymentProviderService");
    const existingProviders = await paymentProviderService.list({ id: providersToLoad }, {});
    const upsertData = [];
    for (const { id } of existingProviders) {
        if (!providersToLoad.includes(id)) {
            upsertData.push({ id, is_enabled: false });
        }
    }
    for (const id of providersToLoad) {
        upsertData.push({ id, is_enabled: true });
    }
    await paymentProviderService.upsert(upsertData);
};
//# sourceMappingURL=providers.js.map