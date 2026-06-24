"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRbacRoutesMiddlewares = void 0;
const middlewares_1 = require("./policies/middlewares");
const middlewares_2 = require("./roles/middlewares");
exports.adminRbacRoutesMiddlewares = [
    ...middlewares_2.adminRbacRoleRoutesMiddlewares,
    ...middlewares_1.adminRbacPolicyRoutesMiddlewares,
];
//# sourceMappingURL=middlewares.js.map