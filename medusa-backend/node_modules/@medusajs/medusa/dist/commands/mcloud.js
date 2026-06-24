"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = mcloud;
const confirm_1 = __importDefault(require("@inquirer/confirm"));
const child_process_1 = require("child_process");
const MCLOUD_PACKAGE = "@medusajs/mcloud";
function isMcloudInstalled() {
    const result = (0, child_process_1.spawnSync)("mcloud", ["--version"], {
        stdio: "ignore",
    });
    return result.status === 0 && !result.error;
}
function getPackageManagerInfo() {
    const userAgent = process.env.npm_config_user_agent ?? "";
    if (userAgent.startsWith("pnpm")) {
        return {
            name: "pnpm",
            args: ["add", "-g", MCLOUD_PACKAGE],
        };
    }
    if (userAgent.startsWith("yarn")) {
        return {
            name: "yarn",
            args: ["global", "add", MCLOUD_PACKAGE],
        };
    }
    if (userAgent.startsWith("bun")) {
        return {
            name: "bun",
            args: ["add", "-g", MCLOUD_PACKAGE],
        };
    }
    return {
        name: "npm",
        args: ["i", "-g", MCLOUD_PACKAGE],
    };
}
async function installMcloud() {
    const packageManager = getPackageManagerInfo();
    const shouldInstall = await (0, confirm_1.default)({
        message: `The mcloud command requires the mcloud CLI. Install latest ${MCLOUD_PACKAGE} globally with ${packageManager.name}?`,
        default: true,
    });
    if (!shouldInstall) {
        process.exit(1);
    }
    const installProcess = (0, child_process_1.spawn)(packageManager.name, packageManager.args, {
        stdio: "inherit",
        shell: process.platform === "win32",
    });
    await new Promise((resolve, reject) => {
        installProcess.on("close", (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`Failed to install ${MCLOUD_PACKAGE}. Try again or install the mcloud CLI manually, or if the issue persists create a Github issue. Error code: ${code}.`));
            }
        });
        installProcess.on("error", (error) => {
            reject(error);
        });
    });
}
function runMcloudProxy(args) {
    const child = (0, child_process_1.spawn)("mcloud", args, {
        stdio: "inherit",
        shell: process.platform === "win32",
    });
    child.on("close", (code) => {
        process.exit(code ?? 1);
    });
    child.on("error", () => {
        process.exit(1);
    });
}
async function mcloud({ args = [] }) {
    if (!isMcloudInstalled()) {
        await installMcloud();
    }
    runMcloudProxy(args);
}
//# sourceMappingURL=mcloud.js.map