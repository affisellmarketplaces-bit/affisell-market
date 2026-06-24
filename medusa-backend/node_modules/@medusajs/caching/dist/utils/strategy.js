"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _DefaultCacheStrategy_cacheInvalidationParser, _DefaultCacheStrategy_cacheModule, _DefaultCacheStrategy_container, _DefaultCacheStrategy_hasher;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultCacheStrategy = void 0;
const utils_1 = require("@medusajs/framework/utils");
const fast_json_stable_stringify_1 = __importDefault(require("fast-json-stable-stringify"));
const parser_1 = require("./parser");
class DefaultCacheStrategy {
    constructor(container, cacheModule) {
        _DefaultCacheStrategy_cacheInvalidationParser.set(this, void 0);
        _DefaultCacheStrategy_cacheModule.set(this, void 0);
        _DefaultCacheStrategy_container.set(this, void 0);
        _DefaultCacheStrategy_hasher.set(this, void 0);
        __classPrivateFieldSet(this, _DefaultCacheStrategy_cacheModule, cacheModule, "f");
        __classPrivateFieldSet(this, _DefaultCacheStrategy_container, container, "f");
        __classPrivateFieldSet(this, _DefaultCacheStrategy_hasher, container.hasher, "f");
    }
    objectHash(input) {
        const str = (0, fast_json_stable_stringify_1.default)(input);
        return __classPrivateFieldGet(this, _DefaultCacheStrategy_hasher, "f").call(this, str);
    }
    async onApplicationStart(schema, joinerConfigs) {
        __classPrivateFieldSet(this, _DefaultCacheStrategy_cacheInvalidationParser, new parser_1.CacheInvalidationParser(schema, joinerConfigs), "f");
        const eventBus = __classPrivateFieldGet(this, _DefaultCacheStrategy_container, "f")[utils_1.Modules.EVENT_BUS];
        const handleEvent = async (data) => {
            try {
                // We dont have to await anything here and the rest can be done in the background
                return;
            }
            finally {
                const eventName = data.name;
                const operation = eventName.split(".").pop();
                const entityType = eventName.split(".").slice(-2).shift();
                const eventData = data.data;
                const normalizedEventData = Array.isArray(eventData)
                    ? eventData
                    : [eventData];
                const tags = [];
                for (const item of normalizedEventData) {
                    const ids = Array.isArray(item.id) ? item.id : [item.id];
                    for (const id of ids) {
                        const entityReference = {
                            type: (0, utils_1.upperCaseFirst)((0, utils_1.toCamelCase)(entityType)),
                            id,
                        };
                        const tags_ = await this.computeTags(item, {
                            entities: [entityReference],
                            operation,
                        });
                        tags.push(...tags_);
                    }
                }
                void __classPrivateFieldGet(this, _DefaultCacheStrategy_cacheModule, "f").clear({
                    tags,
                    options: { autoInvalidate: true },
                });
            }
        };
        eventBus.subscribe("*", handleEvent);
        eventBus.addInterceptor?.(handleEvent);
    }
    async computeKey(input) {
        return this.objectHash(input);
    }
    async computeTags(input, options) {
        // Parse the input object to identify entities
        const entities_ = options?.entities ||
            __classPrivateFieldGet(this, _DefaultCacheStrategy_cacheInvalidationParser, "f").parseObjectForEntities(input);
        if (entities_.length === 0) {
            return [];
        }
        // Build invalidation events to get comprehensive cache keys
        const events = __classPrivateFieldGet(this, _DefaultCacheStrategy_cacheInvalidationParser, "f").buildInvalidationEvents(entities_, options?.operation);
        // Collect all unique cache keys from all events as tags
        const tags = new Set();
        events.forEach((event) => {
            event.cacheKeys.forEach((key) => tags.add(key));
        });
        return Array.from(tags);
    }
}
exports.DefaultCacheStrategy = DefaultCacheStrategy;
_DefaultCacheStrategy_cacheInvalidationParser = new WeakMap(), _DefaultCacheStrategy_cacheModule = new WeakMap(), _DefaultCacheStrategy_container = new WeakMap(), _DefaultCacheStrategy_hasher = new WeakMap();
//# sourceMappingURL=strategy.js.map