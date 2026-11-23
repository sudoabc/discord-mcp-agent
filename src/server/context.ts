import type { Guild } from "discord.js";
import type MCPBot from "../bot.js";

export function getGuild(client: MCPBot): Guild {
    const guildId = getGuildId();

    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error("Guild not found.");

    return guild;
}

export function getGuildId(): string {
    const guildId = process.env.DISCORD_SERVER_ID ?? process.env.GUILD_ID;
    if (!guildId) {
        throw new Error("DISCORD_SERVER_ID or GUILD_ID is not set");
    }
    return guildId;
}
