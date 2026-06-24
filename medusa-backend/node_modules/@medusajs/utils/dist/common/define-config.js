"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_STORE_RESTRICTED_FIELDS = void 0;
exports.defineConfig = defineConfig;
exports.transformModules = transformModules;
const flag_router_1 = require("../feature-flags/flag-router");
const modules_sdk_1 = require("../modules-sdk");
const is_object_1 = require("./is-object");
const is_production_1 = require("./is-production");
const is_string_1 = require("./is-string");
const normalize_import_path_with_source_1 = require("./normalize-import-path-with-source");
const resolve_exports_1 = require("./resolve-exports");
const try_convert_to_number_1 = require("./try-convert-to-number");
const MEDUSA_CLOUD_EXECUTION_CONTEXT = "medusa-cloud";
const DEFAULT_SECRET = "supersecret";
/**
 * Returns the secret to use for signing tokens/cookies. In production
 * environments we never fall back to the hardcoded `DEFAULT_SECRET` since
 * it is publicly known and would allow forging tokens. The caller is
 * expected to surface a proper error downstream when the returned value
 * is `undefined` in production.
 */
function resolveEnvSecret(envValue) {
    if (envValue) {
        return envValue;
    }
    if ((0, is_production_1.isProduction)()) {
        return undefined;
    }
    return DEFAULT_SECRET;
}
const DEFAULT_ADMIN_URL = "/";
const DEFAULT_STORE_CORS = "http://localhost:8000";
const DEFAULT_DATABASE_URL = "postgres://localhost/medusa-starter-default";
const DEFAULT_ADMIN_CORS = "http://localhost:7000,http://localhost:7001,http://localhost:5173";
exports.DEFAULT_STORE_RESTRICTED_FIELDS = [
    "order",
    "orders",
    /*"customer",
    "customers",
    "payment_collection",
    "payment_collections"*/
];
function defineConfig(config = {}) {
    const options = {
        isCloud: process.env.EXECUTION_CONTEXT === MEDUSA_CLOUD_EXECUTION_CONTEXT,
    };
    const projectConfig = normalizeProjectConfig(config.projectConfig, options);
    const adminConfig = normalizeAdminConfig(config.admin);
    const modules = resolveModules(config.modules, options, config.projectConfig);
    applyCloudOptionsToModules(modules, projectConfig?.cloud, adminConfig);
    const plugins = resolvePlugins(config.plugins, options);
    return {
        projectConfig,
        featureFlags: (config.featureFlags ?? {}),
        admin: adminConfig,
        modules: modules,
        logger: config.logger,
        plugins,
    };
}
/**
 * Transforms an array of modules into an object. The last module will
 * take precedence in case of duplicate modules
 */
function transformModules(modules) {
    const remappedModules = modules.reduce((acc, moduleConfig) => {
        if (moduleConfig.scope === "external" && !moduleConfig.key) {
            throw new Error("External modules configuration must have a 'key'. Please provide a key for the module.");
        }
        if ("disable" in moduleConfig && "key" in moduleConfig) {
            acc[moduleConfig.key] = moduleConfig;
        }
        // TODO: handle external modules later
        let serviceName = getKnownModuleName(moduleConfig) ?? "";
        delete moduleConfig.key;
        if (!serviceName && "resolve" in moduleConfig) {
            let resolution = (0, is_string_1.isString)(moduleConfig.resolve)
                ? (0, normalize_import_path_with_source_1.normalizeImportPathWithSource)(moduleConfig.resolve)
                : moduleConfig.resolve;
            const moduleExport = (0, is_string_1.isString)(resolution)
                ? require(resolution)
                : resolution;
            const defaultExport = (0, resolve_exports_1.resolveExports)(moduleExport).default;
            const joinerConfig = typeof defaultExport.service.prototype.__joinerConfig === "function"
                ? defaultExport.service.prototype.__joinerConfig() ?? {}
                : defaultExport.service.prototype.__joinerConfig ?? {};
            serviceName = joinerConfig.serviceName;
            if (!serviceName) {
                throw new Error(`Module ${moduleConfig.resolve} doesn't have a serviceName. Please provide a 'key' for the module or check the service joiner config.`);
            }
        }
        acc[serviceName] = moduleConfig;
        return acc;
    }, {});
    return remappedModules;
}
function getKnownModuleName(moduleConfig) {
    if ("key" in moduleConfig && moduleConfig.key) {
        return moduleConfig.key;
    }
    if ("resolve" in moduleConfig &&
        (0, is_string_1.isString)(moduleConfig.resolve) &&
        modules_sdk_1.REVERSED_MODULE_PACKAGE_NAMES[moduleConfig.resolve]) {
        return modules_sdk_1.REVERSED_MODULE_PACKAGE_NAMES[moduleConfig.resolve];
    }
    return undefined;
}
function asRecord(value) {
    return (0, is_object_1.isObject)(value) ? value : {};
}
function applyDefaultAuthMfaOptions(modules, defaultAuthModuleOptions) {
    modules.forEach((moduleConfig) => {
        const moduleName = getKnownModuleName(moduleConfig);
        if (moduleName !== modules_sdk_1.Modules.AUTH ||
            ("disable" in moduleConfig && moduleConfig.disable)) {
            return;
        }
        const options = asRecord(moduleConfig.options);
        const defaultMfaOptions = asRecord(defaultAuthModuleOptions.mfa);
        const mfaOptions = asRecord(options.mfa);
        moduleConfig.options = {
            ...options,
            mfa: {
                ...defaultMfaOptions,
                ...mfaOptions,
                encryption_key: mfaOptions.encryption_key ?? defaultMfaOptions.encryption_key,
            },
        };
    });
}
function resolvePlugins(configPlugins, { isCloud }) {
    const defaultPlugins = new Map([
        [
            "@medusajs/draft-order",
            { resolve: "@medusajs/draft-order", options: {} },
        ],
    ]);
    if (configPlugins?.length) {
        configPlugins.forEach((plugin) => {
            if (typeof plugin === "string") {
                defaultPlugins.set(plugin, { resolve: plugin, options: {} });
            }
            else {
                defaultPlugins.set(plugin.resolve, plugin);
            }
        });
    }
    // We don't have any cloud plugins yet, but we might in the future
    const cloudPlugins = [...Array.from(defaultPlugins.values())];
    return isCloud ? cloudPlugins : Array.from(defaultPlugins.values());
}
/**
 * The user API allow to use array of modules configuration. This method manage the loading of the
 * user modules along side the default modules and re map them to an object.
 *
 * @param configModules
 */
function resolveModules(configModules, { isCloud }, projectConfig) {
    const authMfaEncryptionKey = process.env.AUTH_MFA_ENCRYPTION_KEY;
    const authModuleOptions = {
        mfa: {
            encryption_key: authMfaEncryptionKey,
        },
        providers: [
            {
                resolve: "@medusajs/medusa/auth-emailpass",
                id: "emailpass",
            },
        ],
    };
    const sharedModules = [
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.STOCK_LOCATION] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.INVENTORY] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.PRODUCT] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.PRICING] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.PROMOTION] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.CUSTOMER] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.SALES_CHANNEL] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.CART] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.REGION] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.API_KEY] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.STORE] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.TAX] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.CURRENCY] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.PAYMENT] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.ORDER] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.SETTINGS] },
        {
            resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.TRANSLATION],
            disable: !flag_router_1.FeatureFlag.isFeatureEnabled("translation"),
        },
        {
            resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.RBAC],
            disable: !flag_router_1.FeatureFlag.isFeatureEnabled("rbac"),
        },
        {
            resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.AUTH],
            options: authModuleOptions,
        },
        {
            resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.USER],
            options: {
                jwt_secret: projectConfig?.http?.jwtSecret ??
                    resolveEnvSecret(process.env.JWT_SECRET),
                jwt_options: projectConfig?.http?.jwtOptions,
                jwt_verify_options: projectConfig?.http?.jwtVerifyOptions,
                jwt_public_key: projectConfig?.http?.jwtPublicKey,
            },
        },
        {
            resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.FULFILLMENT],
            options: {
                providers: [
                    {
                        resolve: "@medusajs/medusa/fulfillment-manual",
                        id: "manual",
                    },
                ],
            },
        },
        {
            resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.NOTIFICATION],
            options: {
                providers: [
                    {
                        resolve: "@medusajs/medusa/notification-local",
                        id: "local",
                        options: {
                            name: "Local Notification Provider",
                            channels: ["feed"],
                        },
                    },
                ],
            },
        },
    ];
    const defaultModules = [
        ...sharedModules,
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.CACHE] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.EVENT_BUS] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.WORKFLOW_ENGINE] },
        { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.LOCKING] },
        {
            resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.FILE],
            options: {
                providers: [
                    {
                        resolve: "@medusajs/medusa/file-local",
                        id: "local",
                    },
                ],
            },
        },
    ];
    const cloudModules = [
        ...sharedModules,
        {
            resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.FILE],
            options: {
                providers: [
                    {
                        id: "s3",
                        resolve: "@medusajs/medusa/file-s3",
                        options: {
                            authentication_method: "s3-iam-role",
                            file_url: process.env.S3_FILE_URL,
                            prefix: process.env.S3_PREFIX,
                            region: process.env.S3_REGION,
                            bucket: process.env.S3_BUCKET,
                            endpoint: process.env.S3_ENDPOINT,
                        },
                    },
                ],
            },
        },
    ];
    if (process.env.REDIS_URL) {
        cloudModules.push(...[
            {
                resolve: modules_sdk_1.TEMPORARY_REDIS_MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.WORKFLOW_ENGINE],
                options: {
                    redis: { url: process.env.REDIS_URL },
                },
            },
            {
                resolve: modules_sdk_1.TEMPORARY_REDIS_MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.CACHE],
                options: { redisUrl: process.env.REDIS_URL },
            },
            {
                resolve: modules_sdk_1.TEMPORARY_REDIS_MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.EVENT_BUS],
                options: {
                    redisUrl: process.env.REDIS_URL,
                    workerOptions: { concurrency: 1 },
                },
            },
            {
                resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.LOCKING],
                options: {
                    providers: [
                        {
                            id: "locking-redis",
                            resolve: modules_sdk_1.TEMPORARY_REDIS_MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.LOCKING],
                            is_default: true,
                            options: {
                                redisUrl: process.env.REDIS_URL,
                            },
                        },
                    ],
                },
            },
        ]);
    }
    else {
        cloudModules.push(...[
            { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.CACHE] },
            { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.EVENT_BUS] },
            { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.WORKFLOW_ENGINE] },
            { resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.LOCKING] },
        ]);
    }
    if (process.env.CACHE_REDIS_URL) {
        cloudModules.push({
            resolve: modules_sdk_1.MODULE_PACKAGE_NAMES[modules_sdk_1.Modules.CACHING],
            options: {
                providers: [
                    {
                        id: "caching-redis",
                        resolve: "@medusajs/medusa/caching-redis",
                        is_default: true,
                        options: {
                            redisUrl: process.env.CACHE_REDIS_URL,
                        },
                    },
                ],
            },
        });
    }
    /**
     * The default set of modules to always use. The end user can swap
     * the modules by providing an alternate implementation via their
     * config. But they can never remove a module from this list.
     */
    const modules = isCloud
        ? cloudModules
        : defaultModules;
    /**
     * Backward compatibility for the old way of defining modules (object vs array)
     */
    if (configModules) {
        if ((0, is_object_1.isObject)(configModules)) {
            const modules_ = (configModules ??
                {});
            Object.entries(modules_).forEach(([key, moduleConfig]) => {
                modules.push({
                    key,
                    ...((0, is_object_1.isObject)(moduleConfig)
                        ? moduleConfig
                        : { disable: !moduleConfig }),
                });
            });
        }
        else if (Array.isArray(configModules)) {
            const modules_ = (configModules ?? []);
            modules.push(...modules_);
        }
        else {
            throw new Error("Invalid modules configuration. Should be an array or object.");
        }
    }
    applyDefaultAuthMfaOptions(modules, authModuleOptions);
    return transformModules(modules);
}
function normalizeProjectConfig(projectConfig, { isCloud }) {
    const { http, redisOptions, sessionOptions, cloud, ...restOfProjectConfig } = projectConfig || {};
    const mergedCloudOptions = {
        environmentHandle: process.env.MEDUSA_CLOUD_ENVIRONMENT_HANDLE,
        sandboxHandle: process.env.MEDUSA_CLOUD_SANDBOX_HANDLE,
        apiKey: process.env.MEDUSA_CLOUD_API_KEY,
        webhookSecret: process.env.MEDUSA_CLOUD_WEBHOOK_SECRET,
        emailsEndpoint: process.env.MEDUSA_CLOUD_EMAILS_ENDPOINT,
        paymentsEndpoint: process.env.MEDUSA_CLOUD_PAYMENTS_ENDPOINT,
        oauthAuthorizeEndpoint: process.env.MEDUSA_CLOUD_OAUTH_AUTHORIZE_ENDPOINT,
        oauthTokenEndpoint: process.env.MEDUSA_CLOUD_OAUTH_TOKEN_ENDPOINT,
        oauthCallbackUrl: process.env.MEDUSA_CLOUD_OAUTH_CALLBACK_URL,
        oauthDisabled: process.env.MEDUSA_CLOUD_OAUTH_DISABLED === "true" ? true : undefined,
        oauthJwksUri: process.env.MEDUSA_CLOUD_OAUTH_JWKS_ENDPOINT,
        oauthAudience: process.env.MEDUSA_CLOUD_OAUTH_AUDIENCE,
        ...cloud,
    };
    const hasCloudOptions = Object.values(mergedCloudOptions).some((value) => value !== undefined);
    /**
     * The defaults to use for the project config. They are shallow merged
     * with the user defined config.
     */
    const config = {
        ...(isCloud ? { redisUrl: process.env.REDIS_URL } : {}),
        databaseUrl: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
        http: {
            storeCors: process.env.STORE_CORS || DEFAULT_STORE_CORS,
            adminCors: process.env.ADMIN_CORS || DEFAULT_ADMIN_CORS,
            authCors: process.env.AUTH_CORS || DEFAULT_ADMIN_CORS,
            jwtSecret: resolveEnvSecret(process.env.JWT_SECRET),
            jwtPublicKey: process.env.JWT_PUBLIC_KEY,
            cookieSecret: resolveEnvSecret(process.env.COOKIE_SECRET),
            restrictedFields: {
                store: exports.DEFAULT_STORE_RESTRICTED_FIELDS,
            },
            ...http,
        },
        redisOptions: {
            retryStrategy(retries) {
                /**
                 * Exponentially increase delay with every retry
                 * attempt. Max to 4s
                 */
                const delay = Math.min(Math.pow(2, retries) * 50, 4000);
                /**
                 * Add a random jitter to not choke the server when multiple
                 * clients are retrying at the same time
                 */
                const jitter = Math.floor(Math.random() * 200);
                return delay + jitter;
            },
            ...redisOptions,
        },
        sessionOptions: {
            ...(isCloud && process.env.SESSION_STORE === "dynamodb"
                ? {
                    dynamodbOptions: {
                        prefix: process.env.DYNAMO_DB_SESSIONS_PREFIX ?? "sess:",
                        hashKey: process.env.DYNAMO_DB_SESSIONS_HASH_KEY ?? "id",
                        initialized: process.env.DYNAMO_DB_SESSIONS_CREATE_TABLE
                            ? false
                            : true,
                        table: process.env.DYNAMO_DB_SESSIONS_TABLE ?? "medusa-sessions",
                        readCapacityUnits: (0, try_convert_to_number_1.tryConvertToNumber)(process.env.DYNAMO_DB_SESSIONS_READ_UNITS, 5),
                        writeCapacityUnits: (0, try_convert_to_number_1.tryConvertToNumber)(process.env.DYNAMO_DB_SESSIONS_WRITE_UNITS, 5),
                        skipThrowMissingSpecialKeys: true,
                    },
                }
                : {}),
            ...sessionOptions,
        },
        // If there are no cloud options, we better don't pollute the project config for people not using the cloud
        ...(hasCloudOptions ? { cloud: mergedCloudOptions } : {}),
        ...restOfProjectConfig,
    };
    if (isCloud &&
        !mergedCloudOptions.oauthDisabled &&
        mergedCloudOptions.oauthAuthorizeEndpoint &&
        mergedCloudOptions.oauthTokenEndpoint) {
        const userAuthMethods = config.http.authMethodsPerActor?.user ?? [
            "emailpass",
        ];
        config.http.authMethodsPerActor = {
            ...config.http.authMethodsPerActor,
            user: userAuthMethods.concat("cloud"),
        };
    }
    return config;
}
function normalizeAdminConfig(adminConfig) {
    /**
     * The defaults to use for the admin config.  They are shallow merged
     * with the user defined config
     */
    return {
        backendUrl: process.env.MEDUSA_BACKEND_URL || DEFAULT_ADMIN_URL,
        path: "/app",
        maxUploadFileSize: 1024 * 1024, // 1MB default
        ...adminConfig,
    };
}
function applyCloudOptionsToModules(modules, config, adminConfig) {
    if (!config) {
        return;
    }
    for (const name in modules) {
        const module = modules[name];
        if (typeof module !== "object") {
            continue;
        }
        switch (name) {
            case modules_sdk_1.Modules.NOTIFICATION:
                module.options = {
                    cloud: {
                        api_key: config.apiKey,
                        endpoint: config.emailsEndpoint,
                        environment_handle: config.environmentHandle,
                        sandbox_handle: config.sandboxHandle,
                    },
                    ...(module.options ?? {}),
                };
                break;
            case modules_sdk_1.Modules.PAYMENT:
                module.options = {
                    cloud: {
                        api_key: config.apiKey,
                        webhook_secret: config.webhookSecret,
                        endpoint: config.paymentsEndpoint,
                        environment_handle: config.environmentHandle,
                        sandbox_handle: config.sandboxHandle,
                    },
                    ...(module.options ?? {}),
                };
                break;
            case modules_sdk_1.Modules.AUTH:
                let callbackUrl = config.oauthCallbackUrl;
                if (!callbackUrl && adminConfig?.backendUrl) {
                    callbackUrl = `${adminConfig?.backendUrl}${adminConfig?.path}/login?auth_provider=cloud`;
                }
                module.options = {
                    cloud: {
                        oauth_authorize_endpoint: config.oauthAuthorizeEndpoint,
                        oauth_token_endpoint: config.oauthTokenEndpoint,
                        oauth_jwks_uri: config.oauthJwksUri,
                        oauth_audience: config.oauthAudience,
                        environment_handle: config.environmentHandle,
                        sandbox_handle: config.sandboxHandle,
                        api_key: config.apiKey,
                        callback_url: callbackUrl,
                        disabled: config.oauthDisabled,
                    },
                    ...(module.options ?? {}),
                };
                break;
            default:
                break;
        }
    }
}
//# sourceMappingURL=define-config.js.map