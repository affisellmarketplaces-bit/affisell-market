"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeRoutesMiddlewares = void 0;
const middlewares_1 = require("./locales/middlewares");
const middlewares_2 = require("./returns/middlewares");
exports.storeRoutesMiddlewares = [
    ...middlewares_1.storeLocalesRoutesMiddlewares,
    ...middlewares_2.storeReturnsRoutesMiddlewares,
];
//# sourceMappingURL=middlewares.js.map