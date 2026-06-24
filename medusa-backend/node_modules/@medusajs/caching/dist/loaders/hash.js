"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const awilix_1 = require("awilix");
exports.default = async ({ container }) => {
    const xxhashhWasm = await import("xxhash-wasm");
    const { h32ToString } = await xxhashhWasm.default();
    container.register("hasher", (0, awilix_1.asValue)(h32ToString));
};
//# sourceMappingURL=hash.js.map