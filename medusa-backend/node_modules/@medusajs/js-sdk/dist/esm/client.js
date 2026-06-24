var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
};
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
import { events } from "fetch-event-stream";
import { stringify } from "qs";
/**
 * The header name used for the publishable API key.
 */
export const PUBLISHABLE_KEY_HEADER = "x-publishable-api-key";
/**
 * The storage key used for storing the locale in localStorage.
 */
export const LOCALE_STORAGE_KEY = "medusa_locale";
// We want to explicitly retrieve the base URL instead of relying on relative paths that differ in behavior between browsers.
const getBaseUrl = (passedBaseUrl) => {
    if (typeof window === "undefined") {
        return passedBaseUrl;
    }
    // If the passed base URL is empty or "/", we use the current origin from the browser.
    if (passedBaseUrl === "" || passedBaseUrl === "/") {
        return window.location.origin;
    }
    return passedBaseUrl;
};
const hasStorage = (storage) => {
    if (typeof window !== "undefined") {
        return storage in window;
    }
    return false;
};
const toBase64 = (str) => {
    if (typeof window !== "undefined") {
        return window.btoa(str);
    }
    return Buffer.from(str).toString("base64");
};
const sanitizeHeaders = (headers) => {
    return Object.assign(Object.assign({}, Object.fromEntries(headers.entries())), { authorization: "<REDACTED>" });
};
const normalizeRequest = (init, headers, config) => {
    var _a, _b, _c;
    let body = init === null || init === void 0 ? void 0 : init.body;
    if (body && ((_a = headers.get("content-type")) === null || _a === void 0 ? void 0 : _a.includes("application/json"))) {
        body = JSON.stringify(body);
    }
    // "credentials" is not supported in some environments (eg. on the backend), and it might throw an exception if the field is set.
    const isFetchCredentialsSupported = "credentials" in Request.prototype;
    // Oftentimes the server will be on a different origin, so we want to default to include
    // Note that the cookie's SameSite attribute takes precedence over this setting.
    const credentials = ((_b = config.auth) === null || _b === void 0 ? void 0 : _b.type) === "session"
        ? ((_c = config.auth) === null || _c === void 0 ? void 0 : _c.fetchCredentials) || "include"
        : "omit";
    return Object.assign(Object.assign(Object.assign({}, init), { headers, credentials: isFetchCredentialsSupported ? credentials : undefined }), (body ? { body: body } : {}));
};
const normalizeResponse = (resp, reqHeaders) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (resp.status >= 300) {
        const jsonError = (yield resp.json().catch(() => ({})));
        throw new FetchError((_a = jsonError.message) !== null && _a !== void 0 ? _a : resp.statusText, resp.statusText, resp.status);
    }
    // If we requested JSON, we try to parse the response. Otherwise, we return the raw response.
    const isJsonRequest = (_b = reqHeaders.get("accept")) === null || _b === void 0 ? void 0 : _b.includes("application/json");
    return isJsonRequest ? yield resp.json() : resp;
});
/**
 * Error class for HTTP fetch operations that includes status information.
 */
export class FetchError extends Error {
    constructor(message, statusText, status) {
        super(message);
        this.statusText = statusText;
        this.status = status;
    }
}
/**
 * The main HTTP client for the Medusa JS SDK.
 */
export class Client {
    get locale() {
        if (hasStorage("localStorage")) {
            const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
            if (storedLocale) {
                return storedLocale;
            }
        }
        return this.locale_;
    }
    constructor(config) {
        this.DEFAULT_JWT_STORAGE_KEY = "medusa_auth_token";
        this.token = "";
        this.locale_ = "";
        this.getApiKeyHeader_ = () => {
            return this.config.apiKey
                ? { Authorization: "Basic " + toBase64(this.config.apiKey + ":") }
                : {};
        };
        this.getPublishableKeyHeader_ = () => {
            return this.config.publishableKey
                ? { [PUBLISHABLE_KEY_HEADER]: this.config.publishableKey }
                : {};
        };
        this.getTokenStorageInfo_ = () => {
            var _a, _b, _c;
            const hasLocal = hasStorage("localStorage");
            const hasSession = hasStorage("sessionStorage");
            const hasCustom = Boolean((_a = this.config.auth) === null || _a === void 0 ? void 0 : _a.storage);
            const storageMethod = ((_b = this.config.auth) === null || _b === void 0 ? void 0 : _b.jwtTokenStorageMethod) ||
                (hasLocal ? "local" : "nostore");
            const storageKey = ((_c = this.config.auth) === null || _c === void 0 ? void 0 : _c.jwtTokenStorageKey) || this.DEFAULT_JWT_STORAGE_KEY;
            if (!hasLocal && storageMethod === "local") {
                this.throwError_("Local JWT storage is only available in the browser");
            }
            if (!hasSession && storageMethod === "session") {
                this.throwError_("Session JWT storage is only available in the browser");
            }
            if (!hasCustom && storageMethod === "custom") {
                this.throwError_("Custom storage was not provided in the config");
            }
            return {
                storageMethod,
                storageKey,
            };
        };
        this.config = Object.assign(Object.assign({}, config), { baseUrl: getBaseUrl(config.baseUrl) });
        const logger = config.logger || {
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug,
        };
        this.logger = Object.assign(Object.assign({}, logger), { debug: config.debug ? logger.debug : () => { } });
        if (hasStorage("localStorage")) {
            this.locale_ = window.localStorage.getItem(LOCALE_STORAGE_KEY) || "";
        }
        this.fetch_ = this.initClient();
    }
    setLocale(locale) {
        if (!window) {
            this.logger.warn("setLocale is not available in the server environment. Please set the locale directly through the 'x-medusa-locale' header.");
            return;
        }
        if (hasStorage("localStorage")) {
            window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
        }
        this.locale_ = locale;
    }
    /**
     * `fetch` closely follows (and uses under the hood) the native `fetch` API. There are, however, few key differences:
     * - Non 2xx statuses throw a `FetchError` with the status code as the `status` property, rather than resolving the promise
     * - You can pass `body` and `query` as objects, and they will be encoded and stringified.
     * - The response gets parsed as JSON if the `accept` header is set to `application/json`, otherwise the raw Response object is returned
     *
     * Since the response is dynamically determined, we cannot know if it is JSON or not. Therefore, it is important to pass `Response` as the return type
     *
     * @param input: FetchInput
     * @param init: FetchArgs
     * @returns Promise<T>
     */
    fetch(input, init) {
        return this.fetch_(input, init);
    }
    /**
     * `fetchStream` is a helper method to deal with server-sent events. It returns an object with a stream and an abort function.
     * It follows a very similar interface to `fetch`, with the return value being an async generator.
     * The stream is an async generator that yields `ServerSentEventMessage` objects, which contains the event name, stringified data, and few other properties.
     * The caller is responsible for handling `disconnect` events and aborting the stream. The caller is also responsible for parsing the data field.
     *
     * @param input: FetchInput
     * @param init: FetchArgs
     * @returns FetchStreamResponse
     */
    fetchStream(input, init) {
        return __awaiter(this, void 0, void 0, function* () {
            const abortController = new AbortController();
            const abortFunc = abortController.abort.bind(abortController);
            const fetchPromise = this.fetch_(input, Object.assign(Object.assign({}, init), { signal: abortController.signal, headers: Object.assign(Object.assign({}, init === null || init === void 0 ? void 0 : init.headers), { accept: "text/event-stream" }) }));
            return {
                stream: (function () {
                    return __asyncGenerator(this, arguments, function* () {
                        const res = yield __await(fetchPromise);
                        if (!res.ok) {
                            const error = new Error(`Stream failed with status ${res.status}`);
                            error.name = "HttpError";
                            throw error;
                        }
                        yield __await(yield* __asyncDelegator(__asyncValues(events(res, abortController.signal))));
                    });
                })(),
                abort: abortFunc
            };
        });
    }
    setToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setToken_(token);
        });
    }
    getToken() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getToken_();
        });
    }
    clearToken() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.clearToken_();
        });
    }
    clearToken_() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { storageMethod, storageKey } = this.getTokenStorageInfo_();
            switch (storageMethod) {
                case "local": {
                    window.localStorage.removeItem(storageKey);
                    break;
                }
                case "session": {
                    window.sessionStorage.removeItem(storageKey);
                    break;
                }
                case "custom": {
                    yield ((_b = (_a = this.config.auth) === null || _a === void 0 ? void 0 : _a.storage) === null || _b === void 0 ? void 0 : _b.removeItem(storageKey));
                    break;
                }
                case "memory": {
                    this.token = "";
                    break;
                }
            }
        });
    }
    initClient() {
        const defaultHeaders = new Headers(Object.assign(Object.assign({ "content-type": "application/json", accept: "application/json" }, this.getApiKeyHeader_()), this.getPublishableKeyHeader_()));
        this.logger.debug("Initiating Medusa client with default headers:\n", `${JSON.stringify(sanitizeHeaders(defaultHeaders), null, 2)}\n`);
        return (input, init) => __awaiter(this, void 0, void 0, function* () {
            // We always want to fetch the up-to-date JWT token before firing off a request.
            const headers = new Headers(defaultHeaders);
            if (this.locale) {
                headers.set("x-medusa-locale", this.locale);
            }
            const customHeaders = Object.assign(Object.assign(Object.assign({ "x-medusa-locale": this.locale }, this.config.globalHeaders), (yield this.getJwtHeader_())), init === null || init === void 0 ? void 0 : init.headers);
            // We use `headers.set` in order to ensure headers are overwritten in a case-insensitive manner.
            Object.entries(customHeaders).forEach(([key, value]) => {
                if (value === null) {
                    headers.delete(key);
                }
                else {
                    headers.set(key, value);
                }
            });
            let normalizedInput = input;
            if (input instanceof URL || typeof input === "string") {
                const baseUrl = new URL(this.config.baseUrl);
                const fullPath = `${baseUrl.pathname.replace(/\/$/, "")}/${input
                    .toString()
                    .replace(/^\//, "")}`;
                normalizedInput = new URL(fullPath, baseUrl.origin);
                if (init === null || init === void 0 ? void 0 : init.query) {
                    const params = Object.fromEntries(normalizedInput.searchParams.entries());
                    const stringifiedQuery = stringify(Object.assign(Object.assign({}, params), init.query), { skipNulls: true });
                    normalizedInput.search = stringifiedQuery;
                }
            }
            this.logger.debug("Performing request to:\n", `URL: ${normalizedInput.toString()}\n`, `Headers: ${JSON.stringify(sanitizeHeaders(headers), null, 2)}\n`);
            // Any non-request errors (eg. invalid JSON in the response) will be thrown as-is.
            return yield fetch(normalizedInput, normalizeRequest(init, headers, this.config)).then((resp) => {
                this.logger.debug(`Received response with status ${resp.status}\n`);
                return normalizeResponse(resp, headers);
            });
        });
    }
    getJwtHeader_() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // If the user has requested for session storage, we don't want to send the JWT token in the header.
            if (((_a = this.config.auth) === null || _a === void 0 ? void 0 : _a.type) === "session") {
                return {};
            }
            const token = yield this.getToken_();
            return token ? { Authorization: `Bearer ${token}` } : {};
        });
    }
    setToken_(token) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { storageMethod, storageKey } = this.getTokenStorageInfo_();
            switch (storageMethod) {
                case "local": {
                    window.localStorage.setItem(storageKey, token);
                    break;
                }
                case "session": {
                    window.sessionStorage.setItem(storageKey, token);
                    break;
                }
                case "custom": {
                    yield ((_b = (_a = this.config.auth) === null || _a === void 0 ? void 0 : _a.storage) === null || _b === void 0 ? void 0 : _b.setItem(storageKey, token));
                    break;
                }
                case "memory": {
                    this.token = token;
                    break;
                }
            }
        });
    }
    getToken_() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { storageMethod, storageKey } = this.getTokenStorageInfo_();
            switch (storageMethod) {
                case "local": {
                    return window.localStorage.getItem(storageKey);
                }
                case "session": {
                    return window.sessionStorage.getItem(storageKey);
                }
                case "custom": {
                    return yield ((_b = (_a = this.config.auth) === null || _a === void 0 ? void 0 : _a.storage) === null || _b === void 0 ? void 0 : _b.getItem(storageKey));
                }
                case "memory": {
                    return this.token;
                }
            }
            return null;
        });
    }
    throwError_(message) {
        this.logger.error(message);
        throw new Error(message);
    }
}
//# sourceMappingURL=client.js.map