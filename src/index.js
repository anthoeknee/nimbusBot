"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var discord_js_1 = require("discord.js");
var config_1 = require("./config");
var ready_1 = require("./events/ready");
var client = new discord_js_1.Client({
    intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMessages, discord_js_1.GatewayIntentBits.MessageContent],
});
client.once("ready", function () { return (0, ready_1.default)(client); });
client.login(config_1.config.discordToken);
