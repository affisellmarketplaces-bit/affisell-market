"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PosthogAnalyticsService = void 0;
const utils_1 = require("@medusajs/framework/utils");
const posthog_node_1 = require("posthog-node");
class PosthogAnalyticsService extends utils_1.AbstractAnalyticsProviderService {
    constructor({ logger }, options) {
        super();
        this.config_ = options;
        this.logger_ = logger;
        if (!options.posthogEventsKey) {
            throw new Error("Posthog API key is not set, but is required");
        }
        this.client_ = new posthog_node_1.PostHog(options.posthogEventsKey, {
            host: options.posthogHost || "https://eu.i.posthog.com",
        });
    }
    async track(data) {
        if (!data.event) {
            throw new Error("Event name is required when tracking an event with Posthog");
        }
        if (!data.actor_id) {
            throw new Error("Actor ID is required when tracking an event with Posthog");
        }
        if (data.group?.id && !data.group?.type) {
            throw new Error("Group type is required if passing group id when tracking an event with Posthog");
        }
        this.client_.capture({
            event: data.event,
            distinctId: data.actor_id,
            properties: data.properties,
            groups: data.group?.id
                ? { [data.group.type]: data.group.id }
                : undefined,
        });
    }
    async identify(data) {
        if ("group" in data) {
            this.client_.groupIdentify({
                groupKey: data.group.id,
                groupType: data.group.type,
                properties: data.properties,
                distinctId: data.actor_id,
            });
        }
        else if (data.actor_id) {
            this.client_.identify({
                distinctId: data.actor_id,
                properties: data.properties,
            });
        }
        else {
            throw new Error("Actor or group is required when identifying an entity with Posthog");
        }
    }
    async shutdown() {
        await this.client_.shutdown();
    }
}
exports.PosthogAnalyticsService = PosthogAnalyticsService;
PosthogAnalyticsService.identifier = "analytics-posthog";
//# sourceMappingURL=posthog-analytics.js.map