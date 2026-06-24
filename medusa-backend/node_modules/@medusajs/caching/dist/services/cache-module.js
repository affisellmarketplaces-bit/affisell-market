"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const modules_sdk_1 = require("@medusajs/framework/modules-sdk");
const utils_1 = require("@medusajs/framework/utils");
const _types_1 = require("../types");
const ONE_HOUR_IN_SECOND = 60 * 60;
class CachingModuleService {
    constructor(container, moduleDeclaration) {
        this.moduleDeclaration = moduleDeclaration;
        this.ongoingRequests = new Map();
        this.__hooks = {
            onApplicationStart: async () => {
                this.onApplicationStart();
            },
            onApplicationShutdown: async () => {
                this.onApplicationShutdown();
            },
            onApplicationPrepareShutdown: async () => {
                this.onApplicationPrepareShutdown();
            },
        };
        this.container = container;
        this.providerService = container.cacheProviderService;
        this.defaultProviderId = container[_types_1.CachingDefaultProvider];
        this.strategyCtr = container.strategy;
        this.strategy = new this.strategyCtr(this.container, this);
        const moduleOptions = "options" in moduleDeclaration
            ? moduleDeclaration.options
            : moduleDeclaration;
        this.ttl = moduleOptions.ttl ?? ONE_HOUR_IN_SECOND;
        this.logger = container.logger ?? console;
    }
    onApplicationStart() {
        const loadedSchema = modules_sdk_1.MedusaModule.getAllJoinerConfigs()
            .map((joinerConfig) => joinerConfig?.schema ?? "")
            .join("\n");
        const defaultMedusaSchema = `
    scalar DateTime
    scalar JSON
    directive @enumValue(value: String) on ENUM_VALUE
  `;
        const { schema: cleanedSchema } = utils_1.GraphQLUtils.cleanGraphQLSchema(defaultMedusaSchema + loadedSchema);
        const mergedSchema = utils_1.GraphQLUtils.mergeTypeDefs(cleanedSchema);
        const schema = utils_1.GraphQLUtils.makeExecutableSchema({
            typeDefs: mergedSchema,
        });
        this.strategy.onApplicationStart?.(schema, modules_sdk_1.MedusaModule.getAllJoinerConfigs());
    }
    onApplicationShutdown() {
        this.strategy.onApplicationShutdown?.();
    }
    onApplicationPrepareShutdown() {
        this.strategy.onApplicationPrepareShutdown?.();
    }
    static normalizeProviders(providers) {
        const providers_ = Array.isArray(providers) ? providers : [providers];
        return providers_.map((provider) => {
            return typeof provider === "string" ? { id: provider } : provider;
        });
    }
    getRequestKey(key, tags, providers) {
        const keyPart = key || "";
        const tagsPart = tags?.sort().join(",") || "";
        const providersPart = providers?.join(",") || this.defaultProviderId;
        return `${keyPart}|${tagsPart}|${providersPart}`;
    }
    getClearRequestKey(key, tags, providers) {
        const keyPart = key || "";
        const tagsPart = tags?.sort().join(",") || "";
        const providersPart = providers?.join(",") || this.defaultProviderId;
        return `clear:${keyPart}|${tagsPart}|${providersPart}`;
    }
    async get(options) {
        if (CachingModuleService.traceGet) {
            return await CachingModuleService.traceGet(() => this.get_(options), options.key ?? "", options.tags ?? []);
        }
        return await this.get_(options);
    }
    async get_({ key, tags, providers, }) {
        if (!key && !tags) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_ARGUMENT, "Either key or tags must be provided");
        }
        const requestKey = this.getRequestKey(key, tags, providers);
        const existingRequest = this.ongoingRequests.get(requestKey);
        if (existingRequest) {
            return await existingRequest;
        }
        const requestPromise = this.performCacheGet(key, tags, providers);
        this.ongoingRequests.set(requestKey, requestPromise);
        try {
            const result = await requestPromise;
            return result;
        }
        finally {
            // Clean up the completed request
            this.ongoingRequests.delete(requestKey);
        }
    }
    async performCacheGet(key, tags, providers) {
        const providersToCheck = providers ?? [this.defaultProviderId];
        for (const providerId of providersToCheck) {
            try {
                const provider_ = this.providerService.retrieveProvider(providerId);
                const result = await provider_.get({ key, tags });
                if (result != null) {
                    return result;
                }
            }
            catch (error) {
                this.logger.warn(`Cache provider ${providerId} failed: ${error.message}\n${error.stack}`);
                continue;
            }
        }
        return null;
    }
    async set(options) {
        if (CachingModuleService.traceSet) {
            return await CachingModuleService.traceSet(() => this.set_(options), options.key, options.tags ?? [], options.options ?? {});
        }
        return await this.set_(options);
    }
    async set_({ key, data, ttl, tags, providers, options, }) {
        if (!key) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_ARGUMENT, "[CachingModuleService] Key must be provided");
        }
        const key_ = key;
        const tags_ = tags ?? (await this.strategy.computeTags(data));
        let providers_ = [
            this.defaultProviderId,
        ];
        providers_ = CachingModuleService.normalizeProviders(providers ?? providers_);
        const providerIds = providers_.map((p) => p.id);
        const requestKey = this.getRequestKey(key_, tags_, providerIds);
        const existingRequest = this.ongoingRequests.get(requestKey);
        if (existingRequest) {
            return await existingRequest;
        }
        const requestPromise = this.performCacheSet(key_, tags_, data, ttl, providers_, options);
        this.ongoingRequests.set(requestKey, requestPromise);
        try {
            await requestPromise;
        }
        finally {
            // Clean up the completed request
            this.ongoingRequests.delete(requestKey);
        }
    }
    async performCacheSet(key, tags, data, ttl, providers, options) {
        for (const providerOptions of providers || []) {
            const ttl_ = providerOptions.ttl ?? ttl ?? this.ttl;
            const provider = this.providerService.retrieveProvider(providerOptions.id);
            void provider.set({
                key,
                tags,
                data,
                ttl: ttl_,
                options,
            });
        }
    }
    async clear(options) {
        if (CachingModuleService.traceClear) {
            return await CachingModuleService.traceClear(() => this.clear_(options), options.key ?? "", options.tags ?? [], options.options ?? {});
        }
        return await this.clear_(options);
    }
    async clear_({ key, tags, options, providers, }) {
        if (!key && !tags) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_ARGUMENT, "Either key or tags must be provided");
        }
        const requestKey = this.getClearRequestKey(key, tags, providers);
        const existingRequest = this.ongoingRequests.get(requestKey);
        if (existingRequest) {
            return await existingRequest;
        }
        const requestPromise = this.performCacheClear(key, tags, options, providers);
        this.ongoingRequests.set(requestKey, requestPromise);
        try {
            await requestPromise;
        }
        finally {
            // Clean up the completed request
            this.ongoingRequests.delete(requestKey);
        }
    }
    async performCacheClear(key, tags, options, providers) {
        let providerIds_ = [this.defaultProviderId];
        if (providers) {
            providerIds_ = Array.isArray(providers) ? providers : [providers];
        }
        for (const providerId of providerIds_) {
            const provider = this.providerService.retrieveProvider(providerId);
            void provider.clear({ key, tags, options });
        }
    }
    async computeKey(input) {
        return await this.strategy.computeKey(input);
    }
    async computeTags(input, options) {
        return await this.strategy.computeTags(input, options);
    }
}
exports.default = CachingModuleService;
//# sourceMappingURL=cache-module.js.map