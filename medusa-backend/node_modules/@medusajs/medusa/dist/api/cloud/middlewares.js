"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudRoutesMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
exports.cloudRoutesMiddlewares = [
    {
        matcher: "/cloud/auth",
        method: ["GET"],
        middlewares: [],
    },
    {
        matcher: "/cloud/auth/users",
        method: ["POST"],
        middlewares: [
            // Allow users who are authenticated but don't yet have an actor (user record)
            (0, http_1.authenticate)("user", ["session", "bearer"], {
                allowUnregistered: true,
            }),
        ],
    },
];
//# sourceMappingURL=middlewares.js.map