import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
    ChannelType,
    PermissionFlagsBits,
    type Guild,
    type GuildEditOptions,
} from "discord.js";
import { z } from "zod";
import type MCPBot from "../../bot.js";
import { getGuild } from "../context.js";
import { RequirePermissions } from "../guards.js";
import { ok, err, type ToolResult } from "../types.js";

function getServer(guild: Guild): ToolResult {
    return ok(JSON.stringify({
        id: guild.id,
        name: guild.name,
        description: guild.description,
        ownerId: guild.ownerId,
        createdAt: guild.createdAt.toISOString(),
        iconUrl: guild.iconURL({ size: 1024 }),
        bannerUrl: guild.bannerURL({ size: 1024 }),
        splashUrl: guild.splashURL({ size: 1024 }),
        boostTier: guild.premiumTier,
        boostCount: guild.premiumSubscriptionCount ?? 0,
        boosters: guild.members.cache.filter((m) => m.premiumSince).size,
        verificationLevel: guild.verificationLevel,
        preferredLocale: guild.preferredLocale,
        features: guild.features,
        systemChannelId: guild.systemChannelId,
        rulesChannelId: guild.rulesChannelId,
        afkChannelId: guild.afkChannelId,
        vanityUrlCode: guild.vanityURLCode,
        channelCount: guild.channels.cache.size,
        roleCount: guild.roles.cache.size,
        emojiCount: guild.emojis.cache.size,
        stickerCount: guild.stickers.cache.size,
        soundboardCount: guild.soundboardSounds.cache.size,
        memberCount: guild.memberCount,
    }));
}

const updateServerSchema = z.object({
    name: z.string().min(2).max(100).optional()
        .describe("New server name."),
    description: z.string().nullable().optional()
        .describe("Server description. Set to null to clear it. Requires the COMMUNITY guild feature."),
    systemChannelId: z.string().nullable().optional()
        .describe("System message channel ID. Use view_channels to find it; set null to disable."),
    rulesChannelId: z.string().nullable().optional()
        .describe("Rules channel ID. Use view_channels to find it; set null to disable."),
    afkChannelId: z.string().nullable().optional()
        .describe("AFK voice channel ID. Use view_channels to find it; set null to disable."),
    afkTimeout: z.number().int().min(60).max(3600).optional()
        .describe("AFK timeout in seconds. An AFK voice channel must be configured."),
    premiumProgressBarEnabled: z.boolean().optional()
        .describe("Whether to show the server boost progress bar."),
}).refine(
    (args) =>
        args.name !== undefined ||
        args.description !== undefined ||
        args.systemChannelId !== undefined ||
        args.rulesChannelId !== undefined ||
        args.afkChannelId !== undefined ||
        args.afkTimeout !== undefined ||
        args.premiumProgressBarEnabled !== undefined,
    { message: "Provide at least one server setting to update." },
);

class GuildTools {
    readonly client: MCPBot;

    constructor(client: MCPBot) {
        this.client = client;
    }

    @RequirePermissions(PermissionFlagsBits.ManageGuild)
    async updateServer(
        guild: Guild,
        args: z.infer<typeof updateServerSchema> & { confirm: boolean; reason?: string | undefined },
    ): Promise<ToolResult> {
        if (!args.confirm) return err("action was not confirmed");

        const patch: GuildEditOptions = {};
        const changed: string[] = [];

        if (args.name !== undefined) {
            patch.name = args.name;
            changed.push("name");
        }

        if (args.description !== undefined) {
            patch.description = args.description;
            changed.push("description");
        }

        if (args.systemChannelId !== undefined) {
            if (args.systemChannelId !== null) {
                const channel = guild.channels.cache.get(args.systemChannelId);
                if (!channel) return err(`System channel "${args.systemChannelId}" not found.`);
                if (channel.type !== ChannelType.GuildText &&
                    channel.type !== ChannelType.GuildAnnouncement)
                    return err(`"${args.systemChannelId}" is not a text channel.`);
            }
            patch.systemChannel = args.systemChannelId;
            changed.push("systemChannel");
        }

        if (args.rulesChannelId !== undefined) {
            if (args.rulesChannelId !== null) {
                const channel = guild.channels.cache.get(args.rulesChannelId);
                if (!channel) return err(`Rules channel "${args.rulesChannelId}" not found.`);
                if (channel.type !== ChannelType.GuildText &&
                    channel.type !== ChannelType.GuildAnnouncement)
                    return err(`"${args.rulesChannelId}" is not a text channel.`);
            }
            patch.rulesChannel = args.rulesChannelId;
            changed.push("rulesChannel");
        }

        if (args.afkChannelId !== undefined) {
            if (args.afkChannelId !== null) {
                const channel = guild.channels.cache.get(args.afkChannelId);
                if (!channel) return err(`AFK channel "${args.afkChannelId}" not found.`);
                if (channel.type !== ChannelType.GuildVoice &&
                    channel.type !== ChannelType.GuildStageVoice)
                    return err(`"${args.afkChannelId}" is not a voice channel.`);
            }
            patch.afkChannel = args.afkChannelId;
            changed.push("afkChannel");
        }

        if (args.afkTimeout !== undefined) {
            patch.afkTimeout = args.afkTimeout;
            changed.push("afkTimeout");
        }

        if (args.premiumProgressBarEnabled !== undefined) {
            patch.premiumProgressBarEnabled = args.premiumProgressBarEnabled;
            changed.push("premiumProgressBarEnabled");
        }

        if (args.reason !== undefined) patch.reason = args.reason;
        if (changed.length === 0) return err("No changes specified.");

        await guild.edit(patch);
        return ok(`Updated server: ${changed.join(", ")}`);
    }
}

export function registerGuildTools(server: McpServer, client: MCPBot): void {
    const tools = new GuildTools(client);

    server.registerTool("get_guild", {
        description: "Get information about the configured server.",
        inputSchema: z.object({}),
    }, () => getServer(getGuild(client)));

    server.registerTool("update_guild", {
        description: "Update selected server settings after the user confirms.",
        inputSchema: updateServerSchema.extend({
            confirm: z.boolean()
                .describe("Set to true to confirm this update."),
            reason: z.string().max(512).optional()
                .describe("Optional reason recorded in the Discord audit log."),
        }),
    }, (args) => tools.updateServer(getGuild(client), args));
}
