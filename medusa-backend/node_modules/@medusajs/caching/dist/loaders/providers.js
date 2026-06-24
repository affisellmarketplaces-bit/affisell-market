"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const modules_sdk_1 = require("@medusajs/framework/modules-sdk");
const utils_1 = require("@medusajs/framework/utils");
const _services_1 = require("../services");
const _types_1 = require("../types");
const awilix_1 = require("awilix");
const memory_cache_1 = require("../providers/memory-cache");
const strategy_1 = require("../utils/strategy");
const registrationFn = async (klass, container, { id }) => {
    const key = _services_1.CachingProviderService.getRegistrationIdentifier(klass);
    if (!id) {
        throw new Error(`No "id" provided for provider ${key}`);
    }
    const regKey = (0, utils_1.getProviderRegistrationKey)({
        providerId: id,
        providerIdentifier: key,
    });
    container.register({
        [_types_1.CachingProviderRegistrationPrefix + id]: (0, awilix_1.aliasTo)(regKey),
    });
    container.registerAdd(_types_1.CachingIdentifiersRegistrationName, (0, awilix_1.asValue)(key));
};
exports.default = async ({ container, options, }) => {
    container.registerAdd(_types_1.CachingIdentifiersRegistrationName, (0, awilix_1.asValue)(undefined));
    const strategy = strategy_1.DefaultCacheStrategy; // Re enable custom strategy another time
    container.register("strategy", (0, awilix_1.asValue)(strategy));
    const inMemoryOptions = options?.in_memory ?? {};
    const { enable: isInMemoryEnabled, ...restInmemoryOptions } = inMemoryOptions;
    if (isInMemoryEnabled) {
        // MemoryCachingProvider - default provider
        container.register({
            [_types_1.CachingProviderRegistrationPrefix + memory_cache_1.MemoryCachingProvider.identifier]: (0, awilix_1.asFunction)((cradle) => new memory_cache_1.MemoryCachingProvider(cradle, restInmemoryOptions), {
                lifetime: awilix_1.Lifetime.SINGLETON,
            }),
        });
        container.registerAdd(_types_1.CachingIdentifiersRegistrationName, (0, awilix_1.asValue)(memory_cache_1.MemoryCachingProvider.identifier));
        container.register(_types_1.CachingDefaultProvider, (0, awilix_1.asValue)(memory_cache_1.MemoryCachingProvider.identifier));
    }
    // Load other providers
    await (0, modules_sdk_1.moduleProviderLoader)({
        container,
        providers: options?.providers || [],
        registerServiceFn: registrationFn,
    });
    const isSingleProvider = options?.providers?.length === 1;
    let hasDefaultProvider = false;
    for (const provider of options?.providers || []) {
        if (provider.is_default || isSingleProvider) {
            hasDefaultProvider = true;
            container.register(_types_1.CachingDefaultProvider, (0, awilix_1.asValue)(provider.id));
        }
    }
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    if (!hasDefaultProvider) {
        if (isInMemoryEnabled) {
            logger.warn(`[caching-module]: No default caching provider defined. Using "${container.resolve(_types_1.CachingDefaultProvider)}" as default.`);
        }
        else {
            throw new Error("[caching-module]: No providers have been configured and the built in memory cache has not been enabled.");
        }
    }
};
//# sourceMappingURL=providers.js.map