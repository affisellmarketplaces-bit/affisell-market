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
var _WorkflowOrchestratorService_logger;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowOrchestratorService = void 0;
const orchestration_1 = require("@medusajs/framework/orchestration");
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const ulid_1 = require("ulid");
const AnySubscriber = "any";
class WorkflowOrchestratorService {
    constructor({ dataLoaderOnly, redisDistributedTransactionStorage, redisPublisher, redisSubscriber, sharedContainer, }) {
        this.instanceId = (0, ulid_1.ulid)();
        _WorkflowOrchestratorService_logger.set(this, void 0);
        this.container_ = sharedContainer;
        this.redisPublisher = redisPublisher;
        this.redisSubscriber = redisSubscriber;
        __classPrivateFieldSet(this, _WorkflowOrchestratorService_logger, this.container_.resolve("logger", { allowUnregistered: true }) ?? console, "f");
        redisDistributedTransactionStorage.setWorkflowOrchestratorService(this);
        if (!dataLoaderOnly) {
            orchestration_1.DistributedTransaction.setStorage(redisDistributedTransactionStorage);
            orchestration_1.WorkflowScheduler.setStorage(redisDistributedTransactionStorage);
        }
        this.redisDistributedTransactionStorage_ =
            redisDistributedTransactionStorage;
        this.redisSubscriber.on("message", async (channel, message) => {
            const workflowId = channel.split(":")[1];
            if (!WorkflowOrchestratorService.subscribers.has(workflowId))
                return;
            try {
                const { instanceId, data } = JSON.parse(message);
                await this.notify(data, false, instanceId);
            }
            catch (error) {
                __classPrivateFieldGet(this, _WorkflowOrchestratorService_logger, "f").error(`Failed to process Redis message: ${error}`);
            }
        });
    }
    async onApplicationShutdown() {
        await this.redisDistributedTransactionStorage_.onApplicationShutdown();
    }
    async onApplicationPrepareShutdown() {
        // eslint-disable-next-line max-len
        await this.redisDistributedTransactionStorage_.onApplicationPrepareShutdown();
    }
    async onApplicationStart() {
        await this.redisDistributedTransactionStorage_.onApplicationStart();
    }
    async triggerParentStep(transaction, result, errors) {
        const metadata = transaction.flow.metadata;
        const { parentStepIdempotencyKey, cancelingFromParentStep } = metadata ?? {};
        if (cancelingFromParentStep) {
            /**
             * If the sub workflow is cancelling from a parent step, we don't want to trigger the parent
             * step.
             */
            return;
        }
        if (parentStepIdempotencyKey) {
            const hasFailed = [
                utils_1.TransactionState.REVERTED,
                utils_1.TransactionState.FAILED,
            ].includes(transaction.flow.state);
            if (hasFailed) {
                await this.setStepFailure({
                    idempotencyKey: parentStepIdempotencyKey,
                    stepResponse: errors,
                    options: {
                        logOnError: true,
                    },
                });
            }
            else {
                await this.setStepSuccess({
                    idempotencyKey: parentStepIdempotencyKey,
                    stepResponse: result,
                    options: {
                        logOnError: true,
                    },
                });
            }
        }
    }
    async run(workflowIdOrWorkflow, options) {
        const { input, transactionId, resultFrom, logOnError, events: eventHandlers, container, } = options ?? {};
        let { throwOnError, context } = options ?? {};
        throwOnError ??= true;
        context ??= {};
        context.transactionId = transactionId ?? "auto-" + (0, ulid_1.ulid)();
        const workflowId = (0, utils_1.isString)(workflowIdOrWorkflow)
            ? workflowIdOrWorkflow
            : workflowIdOrWorkflow.getName();
        if (!workflowId) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Workflow ID is required`);
        }
        const events = this.buildWorkflowEvents({
            customEventHandlers: eventHandlers,
            workflowId,
            transactionId: context.transactionId,
        });
        const exportedWorkflow = workflows_sdk_1.MedusaWorkflow.getWorkflow(workflowId);
        if (!exportedWorkflow) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Workflow with id "${workflowId}" not found.`);
        }
        const { onFinish, ...restEvents } = events;
        const originalOnFinishHandler = events.onFinish;
        const ret = await exportedWorkflow.run({
            input,
            throwOnError: false,
            logOnError,
            resultFrom,
            context,
            events: restEvents,
            container: container ?? this.container_,
        });
        const hasFinished = ret.transaction.hasFinished();
        const metadata = ret.transaction.getFlow().metadata;
        const { parentStepIdempotencyKey } = metadata ?? {};
        const hasFailed = [
            utils_1.TransactionState.REVERTED,
            utils_1.TransactionState.FAILED,
        ].includes(ret.transaction.getFlow().state);
        const acknowledgement = {
            transactionId: context.transactionId,
            workflowId: workflowId,
            parentStepIdempotencyKey,
            hasFinished,
            hasFailed,
        };
        if (hasFinished) {
            const { result, errors } = ret;
            await originalOnFinishHandler({
                transaction: ret.transaction,
                result,
                errors,
            });
            await this.triggerParentStep(ret.transaction, result, errors);
        }
        if (throwOnError && (ret.thrownError || ret.errors?.length)) {
            if (ret.thrownError) {
                throw ret.thrownError;
            }
            throw ret.errors[0].error;
        }
        return { acknowledgement, ...ret };
    }
    async cancel(workflowIdOrWorkflow, options) {
        const { transactionId, logOnError, events: eventHandlers, container, } = options ?? {};
        let { throwOnError, context } = options ?? {};
        throwOnError ??= true;
        context ??= {};
        const workflowId = (0, utils_1.isString)(workflowIdOrWorkflow)
            ? workflowIdOrWorkflow
            : workflowIdOrWorkflow.getName();
        if (!workflowId) {
            throw new Error("Workflow ID is required");
        }
        if (!transactionId) {
            throw new Error("Transaction ID is required");
        }
        const exportedWorkflow = workflows_sdk_1.MedusaWorkflow.getWorkflow(workflowId);
        if (!exportedWorkflow) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Workflow with id "${workflowId}" not found.`);
        }
        const transaction = await this.getRunningTransaction(workflowId, transactionId, { ...options, isCancelling: true });
        if (!transaction) {
            if (!throwOnError) {
                return {
                    acknowledgement: {
                        transactionId,
                        workflowId,
                        exists: false,
                    },
                };
            }
            throw new Error("Transaction not found");
        }
        const events = this.buildWorkflowEvents({
            customEventHandlers: eventHandlers,
            workflowId,
            transactionId: transactionId,
        });
        const { onFinish, ...restEvents } = events;
        const originalOnFinishHandler = events.onFinish;
        const ret = await exportedWorkflow.cancel({
            transaction,
            throwOnError: false,
            logOnError,
            context,
            events: restEvents,
            container: container ?? this.container_,
        });
        const hasFinished = ret.transaction.hasFinished();
        const metadata = ret.transaction.getFlow().metadata;
        const { parentStepIdempotencyKey } = metadata ?? {};
        const transactionState = ret.transaction.getFlow().state;
        const hasFailed = [utils_1.TransactionState.FAILED].includes(transactionState);
        const acknowledgement = {
            transactionId: transaction.transactionId,
            workflowId: workflowId,
            parentStepIdempotencyKey,
            hasFinished,
            hasFailed,
            exists: true,
        };
        if (hasFinished) {
            const { result, errors } = ret;
            await originalOnFinishHandler({
                transaction: ret.transaction,
                result,
                errors,
            });
            await this.triggerParentStep(ret.transaction, result, errors);
        }
        if (throwOnError && (ret.thrownError || ret.errors?.length)) {
            if (ret.thrownError) {
                throw ret.thrownError;
            }
            throw ret.errors[0].error;
        }
        return { acknowledgement, ...ret };
    }
    async getRunningTransaction(workflowId, transactionId, context) {
        if (!workflowId) {
            throw new Error("Workflow ID is required");
        }
        if (!transactionId) {
            throw new Error("TransactionId ID is required");
        }
        context ??= {};
        const exportedWorkflow = workflows_sdk_1.MedusaWorkflow.getWorkflow(workflowId);
        if (!exportedWorkflow) {
            throw new Error(`Workflow with id "${workflowId}" not found.`);
        }
        const flow = exportedWorkflow();
        const transaction = await flow.getRunningTransaction(transactionId, context);
        return transaction;
    }
    async retryStep({ idempotencyKey, options, }) {
        const { context, logOnError, container, events: eventHandlers, } = options ?? {};
        let { throwOnError } = options ?? {};
        throwOnError ??= true;
        const [idempotencyKey_, { workflowId, transactionId }] = this.buildIdempotencyKeyAndParts(idempotencyKey);
        const exportedWorkflow = workflows_sdk_1.MedusaWorkflow.getWorkflow(workflowId);
        if (!exportedWorkflow) {
            throw new Error(`Workflow with id "${workflowId}" not found.`);
        }
        const events = this.buildWorkflowEvents({
            customEventHandlers: eventHandlers,
            transactionId,
            workflowId,
        });
        const { onFinish, ...restEvents } = events;
        const originalOnFinishHandler = events.onFinish;
        const ret = await exportedWorkflow.retryStep({
            idempotencyKey: idempotencyKey_,
            context,
            throwOnError: false,
            logOnError,
            events: restEvents,
            container: container ?? this.container_,
        });
        if (ret.transaction.hasFinished()) {
            const { result, errors } = ret;
            await originalOnFinishHandler({
                transaction: ret.transaction,
                result,
                errors,
            });
            await this.triggerParentStep(ret.transaction, result, errors);
        }
        if (throwOnError && (ret.thrownError || ret.errors?.length)) {
            if (ret.thrownError) {
                throw ret.thrownError;
            }
            throw ret.errors[0].error;
        }
        return ret;
    }
    async setStepSuccess({ idempotencyKey, stepResponse, options, }) {
        const { context, logOnError, resultFrom, container, events: eventHandlers, } = options ?? {};
        let { throwOnError } = options ?? {};
        throwOnError ??= true;
        const [idempotencyKey_, { workflowId, transactionId }] = this.buildIdempotencyKeyAndParts(idempotencyKey);
        const exportedWorkflow = workflows_sdk_1.MedusaWorkflow.getWorkflow(workflowId);
        if (!exportedWorkflow) {
            throw new Error(`Workflow with id "${workflowId}" not found.`);
        }
        const events = this.buildWorkflowEvents({
            customEventHandlers: eventHandlers,
            transactionId,
            workflowId,
        });
        const { onFinish, ...restEvents } = events;
        const originalOnFinishHandler = events.onFinish;
        const ret = await exportedWorkflow.registerStepSuccess({
            idempotencyKey: idempotencyKey_,
            context,
            resultFrom,
            throwOnError: false,
            logOnError,
            events: restEvents,
            response: stepResponse,
            container: container ?? this.container_,
        });
        if (ret.transaction.hasFinished()) {
            const { result, errors } = ret;
            await originalOnFinishHandler({
                transaction: ret.transaction,
                result,
                errors,
            });
            await this.triggerParentStep(ret.transaction, result, errors);
        }
        if (throwOnError && (ret.thrownError || ret.errors?.length)) {
            if (ret.thrownError) {
                throw ret.thrownError;
            }
            throw ret.errors[0].error;
        }
        return ret;
    }
    async setStepFailure({ idempotencyKey, stepResponse, options, }) {
        const { context, logOnError, resultFrom, container, events: eventHandlers, forcePermanentFailure, } = options ?? {};
        let { throwOnError } = options ?? {};
        throwOnError ??= true;
        const [idempotencyKey_, { workflowId, transactionId }] = this.buildIdempotencyKeyAndParts(idempotencyKey);
        const exportedWorkflow = workflows_sdk_1.MedusaWorkflow.getWorkflow(workflowId);
        if (!exportedWorkflow) {
            throw new Error(`Workflow with id "${workflowId}" not found.`);
        }
        const events = this.buildWorkflowEvents({
            customEventHandlers: eventHandlers,
            transactionId,
            workflowId,
        });
        const { onFinish, ...restEvents } = events;
        const originalOnFinishHandler = events.onFinish;
        const ret = await exportedWorkflow.registerStepFailure({
            idempotencyKey: idempotencyKey_,
            context,
            resultFrom,
            throwOnError: false,
            logOnError,
            events: restEvents,
            response: stepResponse,
            container: container ?? this.container_,
            forcePermanentFailure,
        });
        if (ret.transaction.hasFinished()) {
            const { result, errors } = ret;
            await originalOnFinishHandler({
                transaction: ret.transaction,
                result,
                errors,
            });
            await this.triggerParentStep(ret.transaction, result, errors);
        }
        if (throwOnError && (ret.thrownError || ret.errors?.length)) {
            if (ret.thrownError) {
                throw ret.thrownError;
            }
            throw ret.errors[0].error;
        }
        return ret;
    }
    subscribe({ workflowId, transactionId, subscriber, subscriberId, }) {
        subscriber._id = subscriberId;
        const subscribers = WorkflowOrchestratorService.subscribers.get(workflowId) ?? new Map();
        // Subscribe instance to redis
        if (!WorkflowOrchestratorService.subscribers.has(workflowId)) {
            void this.redisSubscriber.subscribe(this.getChannelName(workflowId));
        }
        const handlerIndex = (handlers) => {
            return handlers.findIndex((s) => s === subscriber || s._id === subscriberId);
        };
        if (transactionId) {
            const transactionSubscribers = subscribers.get(transactionId) ?? [];
            const subscriberIndex = handlerIndex(transactionSubscribers);
            if (subscriberIndex !== -1) {
                transactionSubscribers.splice(subscriberIndex, 1);
            }
            transactionSubscribers.push(subscriber);
            subscribers.set(transactionId, transactionSubscribers);
            WorkflowOrchestratorService.subscribers.set(workflowId, subscribers);
            return;
        }
        const workflowSubscribers = subscribers.get(AnySubscriber) ?? [];
        const subscriberIndex = handlerIndex(workflowSubscribers);
        if (subscriberIndex !== -1) {
            workflowSubscribers.splice(subscriberIndex, 1);
        }
        workflowSubscribers.push(subscriber);
        subscribers.set(AnySubscriber, workflowSubscribers);
        WorkflowOrchestratorService.subscribers.set(workflowId, subscribers);
    }
    unsubscribe({ workflowId, transactionId, subscriberOrId, }) {
        const subscribers = WorkflowOrchestratorService.subscribers.get(workflowId);
        if (!subscribers) {
            return;
        }
        const filterSubscribers = (handlers) => {
            return handlers.filter((handler) => {
                return handler._id
                    ? handler._id !== subscriberOrId
                    : handler !== subscriberOrId;
            });
        };
        if (transactionId) {
            const transactionSubscribers = subscribers.get(transactionId);
            if (transactionSubscribers) {
                const newTransactionSubscribers = filterSubscribers(transactionSubscribers);
                if (newTransactionSubscribers.length) {
                    subscribers.set(transactionId, newTransactionSubscribers);
                }
                else {
                    subscribers.delete(transactionId);
                }
            }
        }
        else {
            const workflowSubscribers = subscribers.get(AnySubscriber);
            if (workflowSubscribers) {
                const newWorkflowSubscribers = filterSubscribers(workflowSubscribers);
                if (newWorkflowSubscribers.length) {
                    subscribers.set(AnySubscriber, newWorkflowSubscribers);
                }
                else {
                    subscribers.delete(AnySubscriber);
                }
            }
        }
        if (subscribers.size === 0) {
            WorkflowOrchestratorService.subscribers.delete(workflowId);
            void this.redisSubscriber.unsubscribe(this.getChannelName(workflowId));
        }
    }
    async notify(options, publish = true, instanceId = this.instanceId) {
        if (!publish && instanceId === this.instanceId) {
            return;
        }
        const { workflowId, isFlowAsync } = options;
        // Non-blocking Redis publishing
        if (publish && isFlowAsync) {
            setImmediate(async () => {
                try {
                    const channel = this.getChannelName(workflowId);
                    const message = JSON.stringify({
                        instanceId: this.instanceId,
                        data: options,
                    });
                    await this.redisPublisher.publish(channel, message);
                }
                catch (error) {
                    __classPrivateFieldGet(this, _WorkflowOrchestratorService_logger, "f").error(`Failed to publish to Redis: ${error}`);
                }
            });
        }
        // Process subscribers asynchronously
        setImmediate(() => this.processSubscriberNotifications(options));
    }
    async processSubscriberNotifications(options) {
        const { workflowId, transactionId, eventType } = options;
        const subscribers = WorkflowOrchestratorService.subscribers.get(workflowId) ?? new Map();
        const notifySubscribersAsync = async (handlers) => {
            const promises = handlers.map(async (handler) => {
                try {
                    const result = handler(options);
                    if (result && typeof result === "object" && "then" in result) {
                        await result;
                    }
                }
                catch (error) {
                    __classPrivateFieldGet(this, _WorkflowOrchestratorService_logger, "f").error(`Subscriber error: ${error}`);
                }
            });
            await (0, utils_1.promiseAll)(promises);
        };
        const tasks = [];
        if (transactionId) {
            const transactionSubscribers = subscribers.get(transactionId) ?? [];
            if (transactionSubscribers.length > 0) {
                tasks.push(notifySubscribersAsync(transactionSubscribers));
            }
            if (eventType === "onFinish") {
                subscribers.delete(transactionId);
            }
        }
        const workflowSubscribers = subscribers.get(AnySubscriber) ?? [];
        if (workflowSubscribers.length > 0) {
            tasks.push(notifySubscribersAsync(workflowSubscribers));
        }
        await (0, utils_1.promiseAll)(tasks);
    }
    getChannelName(workflowId) {
        return `orchestrator:${workflowId}`;
    }
    buildWorkflowEvents({ customEventHandlers, workflowId, transactionId, }) {
        const notify = async ({ isFlowAsync, eventType, step, result, response, errors, state, }) => {
            await this.notify({
                isFlowAsync,
                workflowId,
                transactionId,
                eventType,
                response,
                step,
                result,
                errors,
                state,
            });
        };
        return {
            onTimeout: async ({ transaction }) => {
                customEventHandlers?.onTimeout?.({ transaction });
                await notify({
                    eventType: "onTimeout",
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                });
            },
            onBegin: async ({ transaction }) => {
                customEventHandlers?.onBegin?.({ transaction });
                await notify({
                    eventType: "onBegin",
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                });
            },
            onResume: async ({ transaction }) => {
                customEventHandlers?.onResume?.({ transaction });
                await notify({
                    eventType: "onResume",
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                });
            },
            onCompensateBegin: async ({ transaction }) => {
                customEventHandlers?.onCompensateBegin?.({ transaction });
                await notify({
                    eventType: "onCompensateBegin",
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                });
            },
            onFinish: async ({ transaction, result, errors }) => {
                customEventHandlers?.onFinish?.({ transaction, result, errors });
                await notify({
                    eventType: "onFinish",
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                    result,
                    errors,
                    state: transaction.getFlow().state,
                });
            },
            onStepBegin: async ({ step, transaction }) => {
                customEventHandlers?.onStepBegin?.({ step, transaction });
                await notify({
                    eventType: "onStepBegin",
                    step,
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                });
            },
            onStepSuccess: async ({ step, transaction }) => {
                const stepName = step.definition.action;
                const response = await (0, workflows_sdk_1.resolveValue)(transaction.getContext().invoke[stepName], transaction);
                customEventHandlers?.onStepSuccess?.({ step, transaction, response });
                await notify({
                    eventType: "onStepSuccess",
                    step,
                    response,
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                });
            },
            onStepFailure: async ({ step, transaction }) => {
                const stepName = step.definition.action;
                const errors = transaction
                    .getErrors(orchestration_1.TransactionHandlerType.INVOKE)
                    .filter((err) => err.action === stepName);
                customEventHandlers?.onStepFailure?.({ step, transaction, errors });
                await notify({
                    eventType: "onStepFailure",
                    step,
                    errors,
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                });
            },
            onStepAwaiting: async ({ step, transaction }) => {
                customEventHandlers?.onStepAwaiting?.({ step, transaction });
                await notify({
                    eventType: "onStepAwaiting",
                    step,
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                });
            },
            onCompensateStepSuccess: async ({ step, transaction }) => {
                const stepName = step.definition.action;
                const response = transaction.getContext().compensate[stepName];
                customEventHandlers?.onCompensateStepSuccess?.({
                    step,
                    transaction,
                    response,
                });
                await notify({
                    eventType: "onCompensateStepSuccess",
                    step,
                    response,
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                });
            },
            onCompensateStepFailure: async ({ step, transaction }) => {
                const stepName = step.definition.action;
                const errors = transaction
                    .getErrors(orchestration_1.TransactionHandlerType.COMPENSATE)
                    .filter((err) => err.action === stepName);
                customEventHandlers?.onStepFailure?.({ step, transaction, errors });
                await notify({
                    eventType: "onCompensateStepFailure",
                    step,
                    errors,
                    isFlowAsync: transaction.getFlow().hasAsyncSteps,
                });
            },
        };
    }
    buildIdempotencyKeyAndParts(idempotencyKey) {
        const parts = {
            workflowId: "",
            transactionId: "",
            stepId: "",
            action: "invoke",
        };
        let idempotencyKey_ = idempotencyKey;
        const setParts = (workflowId, transactionId, stepId, action) => {
            parts.workflowId = workflowId;
            parts.transactionId = transactionId;
            parts.stepId = stepId;
            parts.action = action;
        };
        if (!(0, utils_1.isString)(idempotencyKey)) {
            const { workflowId, transactionId, stepId, action } = idempotencyKey;
            idempotencyKey_ = [workflowId, transactionId, stepId, action].join(":");
            setParts(workflowId, transactionId, stepId, action);
        }
        else {
            const [workflowId, transactionId, stepId, action] = idempotencyKey_.split(":");
            setParts(workflowId, transactionId, stepId, action);
        }
        return [idempotencyKey_, parts];
    }
}
exports.WorkflowOrchestratorService = WorkflowOrchestratorService;
_WorkflowOrchestratorService_logger = new WeakMap();
WorkflowOrchestratorService.subscribers = new Map();
//# sourceMappingURL=workflow-orchestrator.js.map