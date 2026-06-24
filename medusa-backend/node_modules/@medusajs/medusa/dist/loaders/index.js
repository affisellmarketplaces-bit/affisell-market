"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeContainer = initializeContainer;
const framework_1 = require("@medusajs/framework");
const awilix_1 = require("@medusajs/framework/awilix");
const config_1 = require("@medusajs/framework/config");
const database_1 = require("@medusajs/framework/database");
const feature_flags_1 = require("@medusajs/framework/feature-flags");
const http_1 = require("@medusajs/framework/http");
const jobs_1 = require("@medusajs/framework/jobs");
const links_1 = require("@medusajs/framework/links");
const logger_1 = require("@medusajs/framework/logger");
const subscribers_1 = require("@medusajs/framework/subscribers");
const utils_1 = require("@medusajs/framework/utils");
const workflows_1 = require("@medusajs/framework/workflows");
const path_1 = require("path");
const request_ip_1 = __importDefault(require("request-ip"));
const uuid_1 = require("uuid");
const admin_1 = __importDefault(require("./admin"));
const api_1 = __importDefault(require("./api"));
const isWorkerMode = (configModule) => {
    return configModule.projectConfig.workerMode === "worker";
};
const shouldLoadBackgroundProcessors = (configModule) => {
    return (configModule.projectConfig.workerMode === "worker" ||
        configModule.projectConfig.workerMode === "shared");
};
async function subscribersLoader(plugins, container) {
    const pluginSubscribersSourcePaths = [
        /**
         * Load subscribers from the medusa/medusa package. Remove once the medusa core is converted to a plugin
         */
        (0, path_1.join)(__dirname, "../subscribers"),
    ].concat(plugins.map((plugin) => (0, path_1.join)(plugin.resolve, "subscribers")));
    const subscriberLoader = new subscribers_1.SubscriberLoader(pluginSubscribersSourcePaths, undefined, container);
    await subscriberLoader.load();
}
async function jobsLoader(plugins, container) {
    const pluginJobSourcePaths = [
        /**
         * Load jobs from the medusa/medusa package. Remove once the medusa core is converted to a plugin
         */
        (0, path_1.join)(__dirname, "../jobs"),
    ].concat(plugins.map((plugin) => (0, path_1.join)(plugin.resolve, "jobs")));
    const jobLoader = new jobs_1.JobLoader(pluginJobSourcePaths, container);
    await jobLoader.load();
}
async function loadEntrypoints(plugins, container, expressApp, rootDirectory) {
    const configModule = container.resolve(utils_1.ContainerRegistrationKeys.CONFIG_MODULE);
    if (isWorkerMode(configModule)) {
        return async () => { };
    }
    /**
     * The scope and the ip address must be fetched before we execute any other
     * middleware
     */
    expressApp.use((req, res, next) => {
        req.scope = container.createScope();
        req.requestId = req.headers["x-request-id"] ?? (0, uuid_1.v4)();
        next();
    });
    // Add additional information to context of request
    expressApp.use((req, res, next) => {
        const ipAddress = request_ip_1.default.getClientIp(req);
        req.request_context = {
            ip_address: ipAddress,
        };
        next();
    });
    const [{ shutdown }] = await (0, utils_1.promiseAll)([
        (0, http_1.expressLoader)({
            app: expressApp,
            container,
        }),
        (0, admin_1.default)({ app: expressApp, configModule, rootDirectory, plugins }),
        (0, api_1.default)({
            container,
            plugins,
            app: expressApp,
        }),
    ]);
    return shutdown;
}
async function initializeContainer(rootDirectory, options) {
    await (0, feature_flags_1.featureFlagsLoader)(rootDirectory);
    const configDir = await (0, config_1.configLoader)(rootDirectory, "medusa-config", {
        throwOnValidationError: options?.throwOnValidationError,
    });
    await (0, feature_flags_1.featureFlagsLoader)((0, path_1.join)(__dirname, ".."));
    // Load policies from core medusa package and project root
    await (0, framework_1.policiesLoader)((0, path_1.join)(__dirname, ".."));
    await (0, framework_1.policiesLoader)(rootDirectory);
    const customLogger = configDir.logger ?? logger_1.logger;
    framework_1.container.register({
        [utils_1.ContainerRegistrationKeys.LOGGER]: (0, awilix_1.asValue)(customLogger),
        [utils_1.ContainerRegistrationKeys.REMOTE_QUERY]: (0, awilix_1.asValue)(null),
    });
    if (!options?.skipDbConnection) {
        await (0, database_1.pgConnectionLoader)();
    }
    return framework_1.container;
}
exports.default = async ({ directory: rootDirectory, expressApp, skipLoadingEntryPoints = false, }) => {
    const container = await initializeContainer(rootDirectory);
    const configModule = container.resolve(utils_1.ContainerRegistrationKeys.CONFIG_MODULE);
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const plugins = await (0, utils_1.getResolvedPlugins)(rootDirectory, configModule, true);
    (0, utils_1.mergePluginModules)(configModule, plugins);
    Object.keys(configModule.modules ?? {}).forEach((key) => {
        (0, utils_1.validateModuleName)(key);
    });
    const linksSourcePaths = plugins.map((plugin) => (0, path_1.join)(plugin.resolve, "links"));
    await new links_1.LinkLoader(linksSourcePaths, logger).load();
    // Load policies from all plugins (rootDirectory already loaded in initializeContainer)
    for (const plugin of plugins) {
        await (0, framework_1.policiesLoader)(plugin.resolve);
    }
    const { onApplicationStart, onApplicationShutdown, onApplicationPrepareShutdown, modules, gqlSchema, } = await new framework_1.MedusaAppLoader().load();
    const workflowsSourcePaths = plugins.map((p) => (0, path_1.join)(p.resolve, "workflows"));
    const workflowLoader = new workflows_1.WorkflowLoader(workflowsSourcePaths, container);
    await workflowLoader.load();
    // Subscribers should be loaded no matter the worker mode, simply they will never handle anything
    // since worker/shared instances only will have a running worker to process events.
    await subscribersLoader(plugins, container);
    if (shouldLoadBackgroundProcessors(configModule)) {
        await jobsLoader(plugins, container);
    }
    const entrypointsShutdown = skipLoadingEntryPoints
        ? () => { }
        : await loadEntrypoints(plugins, container, expressApp, rootDirectory);
    const { createDefaultsWorkflow } = await import("@medusajs/core-flows");
    await createDefaultsWorkflow(container).run();
    await onApplicationStart();
    const shutdown = async () => {
        const pgConnection = container.resolve(utils_1.ContainerRegistrationKeys.PG_CONNECTION);
        await onApplicationPrepareShutdown();
        await onApplicationShutdown();
        await (0, utils_1.promiseAll)([
            container.dispose(),
            // @ts-expect-error "Do we want to call `client.destroy` "
            pgConnection?.context?.destroy(),
            entrypointsShutdown(),
        ]);
    };
    return {
        container,
        app: expressApp,
        shutdown,
        modules,
        gqlSchema,
    };
};
//# sourceMappingURL=index.js.map