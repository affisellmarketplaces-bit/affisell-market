"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptClaudeCodePlugin = promptClaudeCodePlugin;
const telemetry_1 = require("@medusajs/telemetry");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const confirm_1 = __importDefault(require("@inquirer/confirm"));
const CLAUDE_DIR = path_1.default.join(os_1.default.homedir(), ".claude");
const INSTALLED_PLUGINS_FILE = path_1.default.join(CLAUDE_DIR, "plugins", "installed_plugins.json");
const PLUGIN_ID = "medusa-dev@medusa";
const CONFIG_KEY = "claude-code-plugin.prompted";
function isClaudeCodePresent() {
    return !!process.env.CLAUDE_CODE || fs_1.default.existsSync(CLAUDE_DIR);
}
function isNonInteractive() {
    return process.env.CI === "true" || !process.stdout.isTTY;
}
function isPluginInstalled() {
    if (!fs_1.default.existsSync(INSTALLED_PLUGINS_FILE)) {
        return false;
    }
    try {
        const data = JSON.parse(fs_1.default.readFileSync(INSTALLED_PLUGINS_FILE, "utf-8"));
        return !!data?.plugins?.[PLUGIN_ID];
    }
    catch {
        return false;
    }
}
function runInstall() {
    try {
        const marketplace = (0, child_process_1.spawnSync)("claude", ["plugin", "marketplace", "add", "medusajs/medusa-agent-skills"], { stdio: "inherit" });
        if (marketplace.error) {
            return false;
        }
        const install = (0, child_process_1.spawnSync)("claude", ["plugin", "install", PLUGIN_ID], {
            stdio: "inherit",
        });
        return !install.error;
    }
    catch {
        return false;
    }
}
async function promptClaudeCodePlugin() {
    if (isNonInteractive() || !isClaudeCodePresent() || isPluginInstalled()) {
        return;
    }
    const configStore = new telemetry_1.Store();
    if (configStore.getConfig(CONFIG_KEY)) {
        return;
    }
    configStore.setConfig(CONFIG_KEY, true);
    const install = await (0, confirm_1.default)({
        message: "Working with Medusa is easier with the Medusa Plugin for Claude Code. Would you like to install it?",
        default: true,
    });
    (0, telemetry_1.track)("MEDUSA_CLAUDE_CODE_PLUGIN_PROMPT", { install });
    if (!install) {
        return;
    }
    const success = runInstall();
    if (!success) {
        console.log("\nCould not auto-install. To install manually, open Claude Code in your project and run:\n\n  /plugin marketplace add medusajs/medusa-agent-skills\n");
    }
}
//# sourceMappingURL=claude-code-plugin.js.map