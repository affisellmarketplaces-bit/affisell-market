"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.instrumentHttpLayer = instrumentHttpLayer;
exports.instrumentRemoteQuery = instrumentRemoteQuery;
exports.instrumentWorkflows = instrumentWorkflows;
exports.instrumentCache = instrumentCache;
exports.registerOtel = registerOtel;
const framework_1 = require("@medusajs/framework");
const http_1 = require("@medusajs/framework/http");
const api_1 = require("@medusajs/framework/opentelemetry/api");
const orchestration_1 = require("@medusajs/framework/orchestration");
const telemetry_1 = require("@medusajs/framework/telemetry");
const utils_1 = require("@medusajs/framework/utils");
const caching_1 = __importDefault(require("../modules/caching"));
const EXCLUDED_RESOURCES = [".vite", "virtual:"];
function shouldExcludeResource(resource) {
    return EXCLUDED_RESOURCES.some((excludedResource) => resource.includes(excludedResource));
}
/**
 * Instrument the first touch point of the HTTP layer to report traces to
 * OpenTelemetry
 */
function instrumentHttpLayer() {
    const startCommand = require("../commands/start");
    const HTTPTracer = new telemetry_1.Tracer("@medusajs/http", "2.0.0");
    startCommand.traceRequestHandler = async (requestHandler, req, res, handlerPath) => {
        if (shouldExcludeResource(req.url)) {
            return await requestHandler();
        }
        const traceName = handlerPath ?? `${req.method} ${req.url}`;
        await HTTPTracer.trace(traceName, async (span) => {
            span.setAttributes({
                "http.route": handlerPath,
                "http.url": req.url,
                "http.method": req.method,
                ...req.headers,
            });
            try {
                await requestHandler();
            }
            finally {
                if (res.statusCode >= 500) {
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: `Failed with ${res.statusMessage}`,
                    });
                }
                span.setAttributes({ "http.statusCode": res.statusCode });
                span.end();
            }
        });
    };
    /**
     * Instrumenting the route handler to report traces to
     * OpenTelemetry
     */
    http_1.ApiLoader.traceRoute = (handler) => {
        return async (req, res) => {
            if (shouldExcludeResource(req.originalUrl)) {
                return await handler(req, res);
            }
            const label = req.route?.path ?? `${req.method} ${req.originalUrl}`;
            const traceName = `route handler: ${label}`;
            await HTTPTracer.trace(traceName, async (span) => {
                try {
                    await handler(req, res);
                }
                catch (error) {
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: error.message || "Failed",
                    });
                    throw error;
                }
                finally {
                    span.end();
                }
            });
        };
    };
    /**
     * Instrumenting the middleware handler to report traces to
     * OpenTelemetry
     */
    http_1.ApiLoader.traceMiddleware = (handler) => {
        return async (req, res, next) => {
            if (shouldExcludeResource(req.originalUrl)) {
                return handler(req, res, next);
            }
            const traceName = `middleware: ${handler.name ? (0, utils_1.camelToSnakeCase)(handler.name) : `anonymous`}`;
            await HTTPTracer.trace(traceName, async (span) => {
                try {
                    await handler(req, res, next);
                }
                catch (error) {
                    span.setStatus({
                        code: api_1.SpanStatusCode.ERROR,
                        message: error.message || "Failed",
                    });
                    throw error;
                }
                finally {
                    span.end();
                }
            });
        };
    };
}
/**
 * Instrument the queries made using the remote query
 */
function instrumentRemoteQuery() {
    const QueryTracer = new telemetry_1.Tracer("@medusajs/query", "2.0.0");
    framework_1.Query.instrument.graphQuery(async function (queryFn, queryOptions) {
        return await QueryTracer.trace(`query.graph: ${queryOptions.entity}`, async (span) => {
            span.setAttributes({
                "query.fields": queryOptions.fields,
            });
            try {
                return await queryFn();
            }
            catch (err) {
                span.setStatus({
                    code: api_1.SpanStatusCode.ERROR,
                    message: err.message,
                });
                throw err;
            }
            finally {
                span.end();
            }
        });
    });
    framework_1.Query.instrument.remoteQuery(async function (queryFn, queryOptions) {
        const traceIdentifier = "entryPoint" in queryOptions
            ? queryOptions.entryPoint
            : "service" in queryOptions
                ? queryOptions.service
                : "__value" in queryOptions
                    ? Object.keys(queryOptions.__value)[0]
                    : "unknown source";
        return await QueryTracer.trace(`remoteQuery: ${traceIdentifier}`, async (span) => {
            span.setAttributes({
                "query.fields": "fields" in queryOptions ? queryOptions.fields : [],
            });
            try {
                return await queryFn();
            }
            catch (error) {
                span.setStatus({
                    code: api_1.SpanStatusCode.ERROR,
                    message: error.message,
                });
                throw error;
            }
            finally {
                span.end();
            }
        });
    });
    framework_1.Query.instrument.remoteDataFetch(async function (fetchFn, serviceName, method, options) {
        return await QueryTracer.trace(`${(0, utils_1.camelToSnakeCase)(serviceName)}.${(0, utils_1.camelToSnakeCase)(method)}`, async (span) => {
            span.setAttributes({
                "fetch.select": options.select,
                "fetch.relations": options.relations,
            });
            try {
                return await fetchFn();
            }
            catch (error) {
                span.setStatus({
                    code: api_1.SpanStatusCode.ERROR,
                    message: error.message,
                });
                throw error;
            }
            finally {
                span.end();
            }
        });
    });
}
/**
 * Instrument the workflows and steps execution
 */
function instrumentWorkflows() {
    const WorkflowsTracer = new telemetry_1.Tracer("@medusajs/framework/workflows-sdk", "2.0.0");
    orchestration_1.TransactionOrchestrator.traceTransaction = async (transactionResumeFn, metadata) => {
        return await WorkflowsTracer.trace(`workflow:${(0, utils_1.camelToSnakeCase)(metadata.model_id)}`, async function (span) {
            span.setAttribute("workflow.transaction_id", metadata.transaction_id);
            if (metadata.flow_metadata) {
                Object.entries(metadata.flow_metadata).forEach(([key, value]) => {
                    span.setAttribute(`workflow.flow_metadata.${key}`, value);
                });
            }
            return await transactionResumeFn().finally(() => span.end());
        });
    };
    orchestration_1.TransactionOrchestrator.traceStep = async (stepHandler, metadata) => {
        return await WorkflowsTracer.trace(`step:${(0, utils_1.camelToSnakeCase)(metadata.action)}:${metadata.type}`, async function (span) {
            Object.entries(metadata).forEach(([key, value]) => {
                span.setAttribute(`workflow.step.${key}`, value);
            });
            // TODO: should we report error and re throw it?
            return await stepHandler().finally(() => span.end());
        });
    };
}
function instrumentCache() {
    if (!utils_1.FeatureFlag.isFeatureEnabled("caching")) {
        return;
    }
    const CacheTracer = new telemetry_1.Tracer("@medusajs/caching", "2.0.0");
    const cacheModule_ = caching_1.default;
    cacheModule_.service.traceGet = async function (cacheGetFn, key, tags) {
        return await CacheTracer.trace(`cache.get`, async (span) => {
            span.setAttributes({
                "cache.key": key,
                "cache.tags": tags,
            });
            try {
                return await cacheGetFn();
            }
            catch (error) {
                span.setStatus({
                    code: api_1.SpanStatusCode.ERROR,
                    message: error.message,
                });
                throw error;
            }
            finally {
                span.end();
            }
        });
    };
    cacheModule_.service.traceSet = async function (cacheSetFn, key, tags, options = {}) {
        return await CacheTracer.trace(`cache.set`, async (span) => {
            span.setAttributes({
                "cache.key": key,
                "cache.tags": tags,
                "cache.options": JSON.stringify(options),
            });
            try {
                return await cacheSetFn();
            }
            catch (error) {
                span.setStatus({
                    code: api_1.SpanStatusCode.ERROR,
                    message: error.message,
                });
                throw error;
            }
            finally {
                span.end();
            }
        });
    };
    cacheModule_.service.traceClear = async function (cacheClearFn, key, tags, options = {}) {
        return await CacheTracer.trace(`cache.clear`, async (span) => {
            span.setAttributes({
                "cache.key": key,
                "cache.tags": tags,
                "cache.options": JSON.stringify(options),
            });
            try {
                return await cacheClearFn();
            }
            catch (error) {
                span.setStatus({
                    code: api_1.SpanStatusCode.ERROR,
                    message: error.message,
                });
                throw error;
            }
            finally {
                span.end();
            }
        });
    };
}
/**
 * A helper function to configure the OpenTelemetry SDK with some defaults.
 * For better/more control, please configure the SDK manually.
 *
 * You will have to install the following packages within your app for
 * telemetry to work
 *
 * - @opentelemetry/sdk-node
 * - @opentelemetry/resources
 * - @opentelemetry/sdk-trace-node
 * - @opentelemetry/instrumentation-pg
 * - @opentelemetry/instrumentation
 */
function registerOtel(options) {
    const { exporter, serviceName, instrument, instrumentations, ...nodeSdkOptions } = {
        instrument: {},
        instrumentations: [],
        ...options,
    };
    const { Resource, resourceFromAttributes, } = require("@medusajs/framework/opentelemetry/resources");
    const { NodeSDK } = require("@medusajs/framework/opentelemetry/sdk-node");
    const { SimpleSpanProcessor, } = require("@medusajs/framework/opentelemetry/sdk-trace-node");
    if (instrument.db) {
        const { PgInstrumentation, } = require("@medusajs/framework/opentelemetry/instrumentation-pg");
        instrumentations.push(new PgInstrumentation());
    }
    if (instrument.http) {
        instrumentHttpLayer();
    }
    if (instrument.query) {
        instrumentRemoteQuery();
    }
    if (instrument.workflows) {
        instrumentWorkflows();
    }
    if (instrument.cache) {
        instrumentCache();
    }
    const sdk = new NodeSDK({
        serviceName,
        /**
         * Older version of "@opentelemetry/resources" exports the "Resource" class.
         * Whereas, the new one exports the "resourceFromAttributes" method.
         */
        resource: resourceFromAttributes
            ? resourceFromAttributes({
                "service.name": serviceName,
            })
            : new Resource({ "service.name": serviceName }),
        spanProcessor: new SimpleSpanProcessor(exporter),
        ...nodeSdkOptions,
        instrumentations: instrumentations,
    });
    sdk.start();
    return sdk;
}
//# sourceMappingURL=index.js.map