import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
    ChannelType,
    PermissionFlagsBits,
    type Guild,
    type GuildBasedChannel,
} from "discord.js";
import { z } from "zod";
import type MCPBot from "../../bot.js";
import { getGuild } from "../context.js";
import { RequirePermissions } from "../guards.js";
import { err, ok, type ToolResult } from "../types.js";

type CreateChannelArgs = {
        name: string;
        type: "text" | "voice" | "category";
        category?: string | undefined;
        nsfw?: boolean | undefined;
};

class ChannelTools {
    readonly client: MCPBot;

    constructor(client: MCPBot) {
        this.client = client;
    }

    @RequirePermissions(PermissionFlagsBits.ManageChannels)
    async createChannel(guild: Guild, args: CreateChannelArgs): Promise<ToolResult> {
        let parentId: string | undefined;
        if (args.category) {
            const category = guild.channels.cache.get(args.category);
            if (!category) {
                return err(`Category "${args.category}" not found.`);
            }
            if (category.type !== ChannelType.GuildCategory) {
                return err(`"${args.category}" is not a category channel.`);
            }
            parentId = category.id;
        }

        let created: GuildBasedChannel;
        const reason = "Channel created via MCP tool";

        if (args.type === "category") {
            created = await guild.channels.create({
                name: args.name,
                type: ChannelType.GuildCategory,
                reason,
            });
        } else if (args.type === "voice") {
            created = await guild.channels.create({
                name: args.name,
                type: ChannelType.GuildVoice,
                reason,
                ...(parentId ? { parent: parentId } : {}),
            });
        } else {
            created = await guild.channels.create({
                name: args.name,
                type: ChannelType.GuildText,
                reason,
                ...(parentId ? { parent: parentId } : {}),
                ...(args.nsfw !== undefined ? { nsfw: args.nsfw } : {}),
            });
        }

        return ok(`Created ${args.type} channel #${created.name} (ID: ${created.id})`);
    }

    @RequirePermissions(PermissionFlagsBits.ManageChannels)
    async deleteChannel(guild: Guild, args: { channel: string; confirm: true }): Promise<ToolResult> {
        const target = guild.channels.cache.get(args.channel);

        if (!target) {
            return err(`Channel "${args.channel}" not found.`);
        }

        await target.delete();
        return ok(`Deleted channel #${target.name}`);
    }
}

function viewChannels(guild: Guild): ToolResult {
    const channels = guild.channels.cache
      .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: ChannelType[channel.type],
          parentId: channel.parentId,
          parentName: channel.parent?.name ?? null,
          position: 'position' in channel ? channel.position : null,
          topic: 'topic' in channel ? channel.topic : null,
          nsfw: 'nsfw' in channel ? channel.nsfw : false,
          slowmodeSeconds: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : 0,
          userLimit: 'userLimit' in channel ? channel.userLimit : null,
          createdAt: channel.createdTimestamp
              ? new Date(channel.createdTimestamp).toISOString()
              : null,
      }));

    return ok(JSON.stringify(channels));
}

export function registerChannelTools(server: McpServer, client: MCPBot): void {
    const tools = new ChannelTools(client);

    server.registerTool("view_channels", {
        description: "View all channels and their IDs in the configured server.",
        inputSchema: z.object({}),
    }, () => viewChannels(getGuild(client)));

    server.registerTool("create_channel", {
        description: "Create a text, voice, or category channel. Use view_channels to obtain a category ID.",
        inputSchema: z.object({
            name: z.string()
                .describe("Name for the new channel."),
            type: z.enum(["text", "voice", "category"]).default("text")
                .describe("Channel type: text, voice, or category."),
            category: z.string().optional()
                .describe("Optional category ID. Use view_channels to look up category IDs."),
            nsfw: z.boolean().optional()
                .describe("Whether a text channel should be marked as NSFW."),
        }),
    }, (args) => tools.createChannel(getGuild(client), args));

    server.registerTool("delete_channel", {
        description: "Delete a channel by ID after the user confirms.",
        inputSchema: z.object({
            channel: z.string()
                .describe("Channel ID (preferred). Use view_channels to look up IDs."),
            confirm: z.literal(true)
                .describe("Set to true to confirm this destructive operation."),
        }),
    }, (args) => tools.deleteChannel(getGuild(client), args));
}
