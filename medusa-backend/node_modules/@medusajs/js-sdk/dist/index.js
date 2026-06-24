"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = exports.Auth = exports.Admin = exports.Client = exports.FetchError = void 0;
const index_js_1 = require("./admin/index.js");
const index_js_2 = require("./auth/index.js");
const client_js_1 = require("./client.js");
const index_js_3 = require("./store/index.js");
class Medusa {
    constructor(config) {
        this.client = new client_js_1.Client(config);
        this.admin = new index_js_1.Admin(this.client);
        this.store = new index_js_3.Store(this.client);
        this.auth = new index_js_2.Auth(this.client, config);
    }
    setLocale(locale) {
        this.client.setLocale(locale);
    }
    getLocale() {
        return this.client.locale;
    }
}
exports.default = Medusa;
var client_js_2 = require("./client.js");
Object.defineProperty(exports, "FetchError", { enumerable: true, get: function () { return client_js_2.FetchError; } });
Object.defineProperty(exports, "Client", { enumerable: true, get: function () { return client_js_2.Client; } });
var index_js_4 = require("./admin/index.js");
Object.defineProperty(exports, "Admin", { enumerable: true, get: function () { return index_js_4.Admin; } });
var index_js_5 = require("./auth/index.js");
Object.defineProperty(exports, "Auth", { enumerable: true, get: function () { return index_js_5.Auth; } });
var index_js_6 = require("./store/index.js");
Object.defineProperty(exports, "Store", { enumerable: true, get: function () { return index_js_6.Store; } });
//# sourceMappingURL=index.js.map