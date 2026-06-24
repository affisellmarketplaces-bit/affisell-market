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
var _SubscriberReloader_eventBusService, _SubscriberReloader_logSource, _SubscriberReloader_logger;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriberReloader = void 0;
const subscribers_1 = require("@medusajs/framework/subscribers");
const utils_1 = require("@medusajs/framework/utils");
const types_1 = require("../types");
const base_1 = require("./base");
/**
 * Handles hot reloading of subscriber files with event-bus unregistration
 */
class SubscriberReloader extends base_1.BaseReloader {
    constructor(container, cacheManager, registry, logSource, logger) {
        super(cacheManager, logSource, logger);
        this.container = container;
        this.registry = registry;
        _SubscriberReloader_eventBusService.set(this, void 0);
        _SubscriberReloader_logSource.set(this, void 0);
        _SubscriberReloader_logger.set(this, void 0);
        __classPrivateFieldSet(this, _SubscriberReloader_logSource, logSource, "f");
        __classPrivateFieldSet(this, _SubscriberReloader_logger, logger, "f");
        __classPrivateFieldSet(this, _SubscriberReloader_eventBusService, container.resolve(utils_1.Modules.EVENT_BUS, {
            allowUnregistered: true,
        }), "f");
    }
    /**
     * Check if a file path represents a subscriber
     */
    isSubscriberPath(filePath) {
        return filePath.includes(types_1.CONFIG.RESOURCE_PATH_PATTERNS.subscriber);
    }
    /**
     * Unregister a subscriber from the event-bus
     */
    unregisterSubscriber(metadata) {
        if (!__classPrivateFieldGet(this, _SubscriberReloader_eventBusService, "f")) {
            return;
        }
        for (const event of metadata.events) {
            // Create a dummy subscriber function - the event-bus will use subscriberId to find the real one
            const dummySubscriber = async () => { };
            dummySubscriber.subscriberId = metadata.subscriberId;
            __classPrivateFieldGet(this, _SubscriberReloader_eventBusService, "f").unsubscribe(event, dummySubscriber, {
                subscriberId: metadata.subscriberId,
            });
        }
        __classPrivateFieldGet(this, _SubscriberReloader_logger, "f").debug(`${__classPrivateFieldGet(this, _SubscriberReloader_logSource, "f")} Unregistered subscriber ${metadata.subscriberId} from events: ${metadata.events.join(", ")}`);
    }
    /**
     * Register a subscriber by loading the file and extracting its metadata
     */
    registerSubscriber(absoluteFilePath) {
        if (!__classPrivateFieldGet(this, _SubscriberReloader_eventBusService, "f")) {
            return;
        }
        try {
            // Load the subscriber module
            const subscriberModule = require(absoluteFilePath);
            new subscribers_1.SubscriberLoader(absoluteFilePath, {}, this.container).createSubscriber({
                fileName: absoluteFilePath,
                config: subscriberModule.config,
                handler: subscriberModule.default,
            });
            __classPrivateFieldGet(this, _SubscriberReloader_logger, "f").debug(`${__classPrivateFieldGet(this, _SubscriberReloader_logSource, "f")} Registered subscriber ${absoluteFilePath}`);
        }
        catch (error) {
            __classPrivateFieldGet(this, _SubscriberReloader_logger, "f").error(`${__classPrivateFieldGet(this, _SubscriberReloader_logSource, "f")} Failed to register subscriber from ${absoluteFilePath}: ${error}`);
        }
    }
    /**
     * Reload a subscriber file if necessary
     */
    async reload(action, absoluteFilePath) {
        if (!this.isSubscriberPath(absoluteFilePath)) {
            return;
        }
        if (!__classPrivateFieldGet(this, _SubscriberReloader_eventBusService, "f")) {
            __classPrivateFieldGet(this, _SubscriberReloader_logger, "f").error(`${__classPrivateFieldGet(this, _SubscriberReloader_logSource, "f")} EventBusService not available - cannot reload subscribers`);
            return;
        }
        const existingResources = this.registry.getResources(absoluteFilePath);
        if (existingResources) {
            for (const [_, resources] of existingResources) {
                for (const resource of resources) {
                    this.unregisterSubscriber({
                        subscriberId: resource.id,
                        events: resource.events,
                    });
                }
            }
        }
        if (action === "add" || action === "change") {
            this.clearModuleCache(absoluteFilePath);
            this.registerSubscriber(absoluteFilePath);
        }
    }
}
exports.SubscriberReloader = SubscriberReloader;
_SubscriberReloader_eventBusService = new WeakMap(), _SubscriberReloader_logSource = new WeakMap(), _SubscriberReloader_logger = new WeakMap();
//# sourceMappingURL=subscribers.js.map