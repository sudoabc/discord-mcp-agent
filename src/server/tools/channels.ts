import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
    ChannelType,
    OverwriteType,
    PermissionFlagsBits,
    VideoQualityMode,
    type Guild,
    type GuildBasedChannel,
    type GuildChannelCreateOptions,
    type OverwriteData,
} from "discord.js";
import { z } from "zod";
import type MCPBot from "../../bot.js";
import { getGuild } from "../context.js";
import { RequirePermissions } from "../guards.js";
import { err, ok, type ToolResult } from "../types.js";

type CreateChannelArgs = {
    name: string;
    type: "text" | "voice" | "category";
    topic?: string | undefined;
    category?: string | undefined;
    nsfw?: boolean | undefined;
    rateLimitPerUser?: number | undefined;
    position?: number | undefined;
    bitrate?: number | undefined;
    userLimit?: number | undefined;
    rtcRegion?: string | undefined;
    videoQualityMode?: "auto" | "full" | undefined;
    permissionOverwrites?: {
        id: string;
        type: "role" | "member";
        allow?: string | undefined;
        deny?: string | undefined;
    }[] | undefined;
    reason?: string | undefined;
};

const validPermissionBitfield = Object.values(PermissionFlagsBits).reduce(
    (combined, permission) => combined | BigInt(permission),
    0n,
);

const permissionBitfieldSchema = z.string()
    .regex(/^(0|[1-9][0-9]*)$/, "Permission bitfield must be a decimal integer string.")
    .refine(
        (value) => (BigInt(value) & ~validPermissionBitfield) === 0n,
        "Permission bitfield contains unknown permission flags.",
    );

const permissionOverwriteSchema = z.object({
    id: z.string().regex(/^\d{17,20}$/, "Overwrite ID must be a Discord snowflake."),
    type: z.enum(["role", "member"]),
    allow: permissionBitfieldSchema.optional(),
    deny: permissionBitfieldSchema.optional(),
}).refine(
    (overwrite) =>
        overwrite.allow === undefined ||
        overwrite.deny === undefined ||
        (BigInt(overwrite.allow) & BigInt(overwrite.deny)) === 0n,
    {
        message: "The allow and deny bitfields cannot contain the same permission.",
        path: ["deny"],
    },
);

class ChannelTools {
    readonly client: MCPBot;

    constructor(client: MCPBot) {
        this.client = client;
    }

    @RequirePermissions(PermissionFlagsBits.ManageChannels)
    async createChannel(guild: Guild, args: CreateChannelArgs): Promise<ToolResult> {
        if (args.type === "voice" && args.bitrate !== undefined &&
            (args.bitrate < 8000 || args.bitrate > guild.maximumBitrate))
            return err(`Voice channel bitrate must be between 8000 and ${guild.maximumBitrate}.`);

        const permissionOverwrites: OverwriteData[] = [];
        if (args.permissionOverwrites) {
            for (const overwrite of args.permissionOverwrites) {
                if (overwrite.type === "role") {
                    if (!guild.roles.cache.has(overwrite.id))
                        return err(`Role "${overwrite.id}" not found.`);
                } else if (!guild.members.cache.has(overwrite.id)) {
                    return err(`Member "${overwrite.id}" not found.`);
                }

                permissionOverwrites.push({
                    id: overwrite.id,
                    type: overwrite.type === "role" ? OverwriteType.Role : OverwriteType.Member,
                    ...(overwrite.allow !== undefined ? { allow: BigInt(overwrite.allow) } : {}),
                    ...(overwrite.deny !== undefined ? { deny: BigInt(overwrite.deny) } : {}),
                });
            }
        }

        let parentId: string | undefined;
        if (args.category) {
            const category = guild.channels.cache.get(args.category);
            if (!category) return err(`Category "${args.category}" not found.`);
            if (category.type !== ChannelType.GuildCategory)
                return err(`"${args.category}" is not a category channel.`);
            parentId = category.id;
        }

        let created: GuildBasedChannel;
        const reason = args.reason ?? "Channel created via MCP tool";
        const common: GuildChannelCreateOptions = {
            name: args.name,
            reason,
            ...(parentId ? { parent: parentId } : {}),
            ...(args.position !== undefined ? { position: args.position } : {}),
            ...(permissionOverwrites.length > 0 ? { permissionOverwrites } : {}),
        };

        if (args.type === "category") {
            created = await guild.channels.create({
                ...common,
                type: ChannelType.GuildCategory,
            });
        } else if (args.type === "voice") {
            created = await guild.channels.create({
                ...common,
                type: ChannelType.GuildVoice,
                ...(args.bitrate !== undefined ? { bitrate: args.bitrate } : {}),
                ...(args.userLimit !== undefined ? { userLimit: args.userLimit } : {}),
                ...(args.rtcRegion !== undefined ? { rtcRegion: args.rtcRegion } : {}),
                ...(args.videoQualityMode !== undefined
                    ? {
                        videoQualityMode: args.videoQualityMode === "full"
                            ? VideoQualityMode.Full
                            : VideoQualityMode.Auto,
                    }
                    : {}),
            });
        } else {
            created = await guild.channels.create({
                ...common,
                type: ChannelType.GuildText,
                ...(args.nsfw !== undefined ? { nsfw: args.nsfw } : {}),
                ...(args.topic !== undefined ? { topic: args.topic } : {}),
                ...(args.rateLimitPerUser !== undefined
                    ? { rateLimitPerUser: args.rateLimitPerUser }
                    : {}),
            });
        }

        return ok(`Created ${args.type} channel #${created.name} (ID: ${created.id})`);
    }

    @RequirePermissions(PermissionFlagsBits.ManageChannels)
    async deleteChannel(guild: Guild, args: { channel: string; confirm: boolean; reason?: string | undefined }): Promise<ToolResult> {
        if (!args.confirm) return err("action was not confirmed");

        const target = guild.channels.cache.get(args.channel);
        if (!target) return err(`Channel "${args.channel}" not found.`);

        await target.delete(args.reason);
        return ok(`Deleted channel #${target.name}`);
    }

    viewChannel(guild: Guild, args: { channel: string }): ToolResult {
        const channel = guild.channels.cache.get(args.channel);
        if (!channel) return err(`Channel "${args.channel}" not found.`);

        const info = {
            id: channel.id,
            name: channel.name,
            type: ChannelType[channel.type],
            parentId: channel.parentId,
            parentName: channel.parent?.name ?? null,
            position: 'position' in channel ? channel.position : null,
            rawPosition: 'rawPosition' in channel ? channel.rawPosition : null,
            topic: 'topic' in channel ? channel.topic : null,
            nsfw: 'nsfw' in channel ? channel.nsfw : false,
            slowmodeSeconds: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : 0,
            userLimit: 'userLimit' in channel ? channel.userLimit : null,
            bitrate: 'bitrate' in channel ? channel.bitrate : null,
            rtcRegion: 'rtcRegion' in channel ? channel.rtcRegion : null,
            videoQualityMode: 'videoQualityMode' in channel
                ? (channel.videoQualityMode === VideoQualityMode.Full
                    ? "full"
                    : channel.videoQualityMode === VideoQualityMode.Auto
                        ? "auto"
                        : null)
                : null,
            permissionsLocked: 'permissionsLocked' in channel
                ? channel.permissionsLocked
                : null,
            permissionOverwrites: 'permissionOverwrites' in channel
                ? [...channel.permissionOverwrites.cache.values()].map(overwrite => ({
                    id: overwrite.id,
                    type: overwrite.type === OverwriteType.Role ? "role" : "member",
                        name: overwrite.type === OverwriteType.Role
                            ? guild.roles.cache.get(overwrite.id)?.name ?? null
                            : guild.members.cache.get(overwrite.id)?.displayName ?? null,
                        allow: overwrite.allow.toString(),
                        deny: overwrite.deny.toString(),
                    }))
                    : [],
                viewable: 'viewable' in channel ? channel.viewable : null,
                createdAt: channel.createdTimestamp
                    ? new Date(channel.createdTimestamp).toISOString()
                    : null
        }

        return ok(JSON.stringify(info));
    }

    getChannelWebhooks(guild: Guild, args: { channel: string }): ToolResult {
        const channel = guild.channels.cache.get(args.channel);
        if (!channel) return err(`Channel "${args.channel}" not found.`);

        if (channel.type !== ChannelType.GuildText &&
            channel.type !== ChannelType.GuildAnnouncement)
            return err(`"${args.channel}" is not a text channel.`);

        const webhooks = channel.fetchWebhooks()
            .then(hooks => hooks.map(hook => ({
                id: hook.id,
                name: hook.name,
                url: hook.url,
                ownerId: hook.owner?.id ?? null,
                ownerName: hook.owner?.username ?? null,
                createdAt: hook.createdAt.toISOString()
            })))
            .catch(() => null);

        return ok(JSON.stringify(webhooks));
    }

    viewChannels(guild: Guild): ToolResult {
        const channels = guild.channels.cache
            .map(channel => ({
                id: channel.id,
                name: channel.name,
                type: ChannelType[channel.type],
                parentId: channel.parentId,
                parentName: channel.parent?.name ?? null,
                position: 'position' in channel ? channel.position : null,
                rawPosition: 'rawPosition' in channel ? channel.rawPosition : null,
                topic: 'topic' in channel ? channel.topic : null,
                nsfw: 'nsfw' in channel ? channel.nsfw : false,
                slowmodeSeconds: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : 0,
                userLimit: 'userLimit' in channel ? channel.userLimit : null,
                bitrate: 'bitrate' in channel ? channel.bitrate : null,
                rtcRegion: 'rtcRegion' in channel ? channel.rtcRegion : null,
                videoQualityMode: 'videoQualityMode' in channel
                    ? (channel.videoQualityMode === VideoQualityMode.Full
                        ? "full"
                        : channel.videoQualityMode === VideoQualityMode.Auto
                            ? "auto"
                            : null)
                    : null,
                permissionsLocked: 'permissionsLocked' in channel
                    ? channel.permissionsLocked
                    : null,
                permissionOverwrites: 'permissionOverwrites' in channel
                    ? [...channel.permissionOverwrites.cache.values()].map(overwrite => ({
                        id: overwrite.id,
                        type: overwrite.type === OverwriteType.Role ? "role" : "member",
                        name: overwrite.type === OverwriteType.Role
                            ? guild.roles.cache.get(overwrite.id)?.name ?? null
                            : guild.members.cache.get(overwrite.id)?.displayName ?? null,
                        allow: overwrite.allow.toString(),
                        deny: overwrite.deny.toString(),
                    }))
                    : [],
                viewable: 'viewable' in channel ? channel.viewable : null,
                createdAt: channel.createdTimestamp
                    ? new Date(channel.createdTimestamp).toISOString()
                    : null,
        }));

        return ok(JSON.stringify(channels));
    }
}

export function registerChannelTools(server: McpServer, client: MCPBot): void {
    const tools = new ChannelTools(client);

    server.registerTool("view_channels", {
        description: "View all channels and their IDs in the configured server.",
        inputSchema: z.object({}),
    }, () => tools.viewChannels(getGuild(client)));

    server.registerTool("view_channel", {
        description: "View detailed information about a channel by ID.",
        inputSchema: z.object({
            channel: z.string()
                .describe("Channel ID (preferred). Use view_channels to look up IDs."),
        }),
    }, (args) => tools.viewChannel(getGuild(client), args));

    server.registerTool("get_channel_webhooks", {
        description: "View all webhooks in a text channel by ID.",
        inputSchema: z.object({
            channel: z.string()
                .describe("Channel ID (preferred). Use view_channels to look up IDs."),
        }),
    }, (args) => tools.getChannelWebhooks(getGuild(client), args))

    server.registerTool("create_channel", {
        description: "Create a text, voice, or category channel. Use view_channels to obtain a category ID.",
        inputSchema: z.object({
            name: z.string()
                .min(1).max(100)
                .describe("Name for the new channel."),
            type: z.enum(["text", "voice", "category"]).default("text")
                .describe("Channel type: text, voice, or category."),
            category: z.string().optional()
                .describe("Optional category ID. Use view_channels to look up category IDs."),
            topic: z.string().max(1024).optional()
                .describe("Text-channel topic, for text channels only. Maximum 1024 characters."),
            nsfw: z.boolean().optional()
                .describe("Whether a text channel should be marked as NSFW. Text channels only."),
            rateLimitPerUser: z.number().int().min(0).max(21600).optional()
                .describe("Slowmode delay in seconds for text channels only. Range: 0 to 21600."),
            position: z.number().int().min(0).optional()
                .describe("Sorting position of the channel. Lower values appear earlier."),
            bitrate: z.number().int().min(8000).optional()
                .describe("Voice-channel bitrate in bits per second. Voice channels only; server limits apply."),
            userLimit: z.number().int().min(0).max(99).optional()
                .describe("Maximum users in a voice channel. Use 0 for no limit. Voice channels only."),
            rtcRegion: z.string().optional()
                .describe("Optional voice RTC region identifier, such as us-east. Voice channels only."),
            videoQualityMode: z.enum(["auto", "full"]).optional()
                .describe("Voice-channel video quality: auto or full (720p). Voice channels only."),
            permissionOverwrites: z.array(permissionOverwriteSchema).max(500).optional()
                .describe(
                    "Channel permission overrides. Use role or member IDs, a type of role or member, "
                    + "and decimal allow/deny permission bitfields. allow and deny must not contain the same permission.",
                ),
            reason: z.string().max(512).optional()
                .describe("Optional reason recorded in the Discord audit log."),
        }).superRefine((args, ctx) => {
            if (args.type !== "text" &&
                (args.topic !== undefined || args.nsfw !== undefined || args.rateLimitPerUser !== undefined)) {
                ctx.addIssue({
                    code: "custom",
                    message: "topic, nsfw, and rateLimitPerUser can only be used with text channels.",
                });
            }

            if (args.type !== "voice" &&
                (args.bitrate !== undefined || args.userLimit !== undefined ||
                    args.rtcRegion !== undefined || args.videoQualityMode !== undefined)) {
                ctx.addIssue({
                    code: "custom",
                    message: "Voice channel options can only be used with voice channels.",
                });
            }

            if (args.type === "category" && args.category !== undefined) {
                ctx.addIssue({
                    code: "custom",
                    path: ["category"],
                    message: "A category channel cannot be placed inside another category.",
                });
            }
        }),
    }, (args) => tools.createChannel(getGuild(client), args));

    server.registerTool("delete_channel", {
        description: "Delete a channel by ID after the user confirms.",
        inputSchema: z.object({
            channel: z.string()
                .describe("Channel ID (preferred). Use view_channels to look up IDs."),
            confirm: z.boolean()
                .describe("Set to true to confirm this destructive operation."),
            reason: z.string().max(512).optional()
                .describe("Optional reason recorded in the Discord audit log."),
        }),
    }, (args) => tools.deleteChannel(getGuild(client), args));
}
