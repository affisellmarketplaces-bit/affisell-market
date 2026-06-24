"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const events_1 = require("events");
const promises_1 = require("timers/promises");
const eventEmitter = new events_1.EventEmitter();
eventEmitter.setMaxListeners(Infinity);
// eslint-disable-next-line max-len
class LocalEventBusService extends utils_1.AbstractEventBusModuleService {
    constructor({ logger }, moduleOptions = {}, moduleDeclaration) {
        // @ts-ignore
        // eslint-disable-next-line prefer-rest-params
        super(...arguments);
        this.logger_ = logger ?? console;
        this.eventEmitter_ = eventEmitter;
        this.groupedEventsMap_ = new Map();
    }
    logProcessingEvent(eventData, options = {}, totalSubscribers) {
        if (totalSubscribers &&
            !options?.internal &&
            !eventData.options?.internal) {
            this.logger_.info(`Processing ${eventData.name} which has ${totalSubscribers} subscribers`);
        }
    }
    /**
     * Accept an event name and some options
     *
     * @param eventsData
     * @param options The options can include `internal` which will prevent the event from being logged
     */
    async emit(eventsData, options = {}) {
        const normalizedEventsData = Array.isArray(eventsData)
            ? eventsData
            : [eventsData];
        for (const eventData of normalizedEventsData) {
            await this.groupOrEmitEvent({
                ...eventData,
                options,
            });
        }
    }
    // If the data of the event consists of a eventGroupId, we don't emit the event, instead
    // we add them to a queue grouped by the eventGroupId and release them when
    // explicitly requested.
    // This is useful in the event of a distributed transaction where you'd want to emit
    // events only once the transaction ends.
    async groupOrEmitEvent(eventData) {
        const { options, ...eventBody } = eventData;
        const eventGroupId = eventBody.metadata?.eventGroupId;
        const hasStarSubscriber = this.eventEmitter_.listenerCount("*") > 0;
        if (eventGroupId) {
            await this.groupEvent(eventGroupId, eventData);
        }
        else {
            const options_ = eventData.options;
            const delay = (ms) => (ms ? (0, promises_1.setTimeout)(ms) : Promise.resolve());
            const eventListenersCount = this.eventEmitter_.listenerCount(eventData.name);
            delay(options_?.delay).then(async () => {
                // Call interceptors before emitting
                void this.callInterceptors(eventData, { isGrouped: false });
                if (eventListenersCount) {
                    this.eventEmitter_.emit(eventData.name, eventBody);
                }
                if (hasStarSubscriber) {
                    this.eventEmitter_.emit("*", eventBody);
                }
                const totalSubscribers = eventListenersCount + (hasStarSubscriber ? 1 : 0);
                this.logProcessingEvent(eventData, options, totalSubscribers);
            });
        }
    }
    // Groups an event to a queue to be emitted upon explicit release
    async groupEvent(eventGroupId, eventData) {
        const groupedEvents = this.groupedEventsMap_.get(eventGroupId) || [];
        groupedEvents.push(eventData);
        this.groupedEventsMap_.set(eventGroupId, groupedEvents);
    }
    async releaseGroupedEvents(eventGroupId) {
        let groupedEvents = this.groupedEventsMap_.get(eventGroupId) || [];
        groupedEvents = JSON.parse(JSON.stringify(groupedEvents));
        const hasStarSubscriber = this.eventEmitter_.listenerCount("*") > 0;
        for (const event of groupedEvents) {
            const { options, ...eventBody } = event;
            const eventListenersCount = this.eventEmitter_.listenerCount(event.name);
            const options_ = options;
            const delay = (ms) => (ms ? (0, promises_1.setTimeout)(ms) : Promise.resolve());
            delay(options_?.delay).then(async () => {
                // Call interceptors before emitting grouped events
                void this.callInterceptors(event, { isGrouped: true, eventGroupId });
                if (eventListenersCount) {
                    this.eventEmitter_.emit(event.name, eventBody);
                }
                if (hasStarSubscriber) {
                    this.eventEmitter_.emit("*", eventBody);
                }
                const totalSubscribers = eventListenersCount + (hasStarSubscriber ? 1 : 0);
                this.logProcessingEvent(event, options, totalSubscribers);
            });
        }
        await this.clearGroupedEvents(eventGroupId);
    }
    async clearGroupedEvents(eventGroupId, { eventNames } = {}) {
        if (eventNames?.length) {
            const groupedEvents = this.groupedEventsMap_.get(eventGroupId) || [];
            const eventsToKeep = groupedEvents.filter((event) => !eventNames.includes(event.name));
            this.groupedEventsMap_.set(eventGroupId, eventsToKeep);
        }
        else {
            this.groupedEventsMap_.delete(eventGroupId);
        }
    }
    subscribe(event, subscriber, context) {
        super.subscribe(event, subscriber, context);
        const subscriberId = context?.subscriberId ?? subscriber.subscriberId;
        const wrappedSubscriber = async (data) => {
            try {
                await subscriber(data);
            }
            catch (err) {
                this.logger_.error(`An error occurred while processing ${event.toString()}:`);
                this.logger_.error(err);
            }
        };
        if (subscriberId) {
            ;
            wrappedSubscriber.subscriberId = subscriberId;
        }
        this.eventEmitter_.on(event, wrappedSubscriber);
        return this;
    }
    unsubscribe(event, subscriber, context) {
        super.unsubscribe(event, subscriber, context);
        const subscriberId = context?.subscriberId ?? subscriber.subscriberId;
        if (subscriberId) {
            const listeners = this.eventEmitter_.listeners(event);
            const wrappedSubscriber = listeners.find((listener) => listener.subscriberId === subscriberId);
            if (wrappedSubscriber) {
                this.eventEmitter_.off(event, wrappedSubscriber);
            }
        }
        else {
            this.eventEmitter_.off(event, subscriber);
        }
        return this;
    }
}
exports.default = LocalEventBusService;
//# sourceMappingURL=event-bus-local.js.map