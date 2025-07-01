"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
function getEnvVar(name) {
    var value = Bun.env[name] || process.env[name];
    if (!value) {
        throw new Error("".concat(name, " is not set in the environment variables."));
    }
    return value;
}
exports.config = {
    discordToken: getEnvVar("DISCORD_TOKEN"),
    geminiAPIKey: getEnvVar("GEMINI_API_KEY"),
};
