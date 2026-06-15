import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Guild, PermissionFlagsBits, ChannelType, type ColorResolvable } from "discord.js";
import { z } from "zod";
import { RequirePermissions, RequireHierarchy } from "./guards.js";
import MCPBot from "./bot.js";

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const err = (text: string) => ({ content: [{ type: "text" as const, text: `❌ ${text}` }] });

export default class MCPServer extends McpServer {
    client: MCPBot;

    constructor(client: MCPBot) {
        super({ name: "discord-mcp", version: "1.0.0" });
        this.client = client;
        this.registerTools();
    }

    @RequirePermissions(PermissionFlagsBits.ManageChannels)
    async createChannel(
        guild: Guild, 
        args: { 
            name: string; 
            type: "text" | "voice" | "category"; 
            category?: string | undefined, 
            nsfw?: boolean | undefined
        }
    ) {
        const { name, type, category, nsfw } = args;

        const channelType =
        type === "voice" ? ChannelType.GuildVoice
        : type === "category" ? ChannelType.GuildCategory
        : ChannelType.GuildText;

        let parentId: string | undefined;
        if (category) {
            const found = guild.channels.cache.find(
            (c) => (c.name === category || c.id === category) && c.type === ChannelType.GuildCategory
            );
            if (!found) return err(`Category "${category}" not found.`);
            parentId = found.id;
        }

        const channelOptions: any = {
            name: name,
            type: channelType,
            reason: "Channel created via MCP tool"
        };

        if (type !== "category") {
            if (nsfw !== undefined) 
                channelOptions.nsfw = nsfw;
            
            if (parentId) 
                channelOptions.parent = parentId;
        }

        const created = await guild.channels.create(channelOptions);
        return ok(`Created ${type} channel #${created.name} (ID: ${created.id})`);
    }

    @RequirePermissions(PermissionFlagsBits.ManageChannels)
    async deleteChannel(guild: Guild, args: { channel: string }) {
        const target = guild.channels.cache.find(
            (c) => c.name === args.channel || c.id === args.channel
        );
        if (!target) return err(`Channel "${args.channel}" not found.`);

        await target.delete();
        return ok(`Deleted channel #${target.name}`);
    }

    @RequirePermissions(PermissionFlagsBits.ManageRoles)
    async createRole(
        guild: Guild, 
        args: { 
            name: string; 
            color?: string | undefined; 
            mentionable?: boolean | undefined; 
            hoist?: boolean | undefined 
        }
    ) {
        const role = await guild.roles.create({
            name: args.name,
            mentionable: args.mentionable ?? false,
            hoist: args.hoist ?? false,
            reason: "Role created via MCP tool",
            ...(args.color ? { color: args.color as ColorResolvable } : {})
        });
        return ok(`Created role "${role.name}" (ID: ${role.id})`);
    }

    @RequirePermissions(PermissionFlagsBits.ManageRoles)
    @RequireHierarchy((args) => args.role)
    async deleteRole(guild: Guild, args: { role: string }) {
        const target = guild.roles.cache.find(
            (r) => r.name === args.role || r.id === args.role
        );

        await target!.delete();
        return ok(`Deleted role "${target!.name}"`);
    }

    @RequirePermissions(PermissionFlagsBits.ManageGuild)
    async renameServer(guild: Guild, args: { name: string }) {
        const old = guild.name;
        await guild.setName(args.name);
        return ok(`Server renamed from "${old}" to "${args.name}"`);
    }

    private registerTools(): void {
        const guild = () => {
            const g = this.client.guilds.cache.get(process.env.GUILD_ID!);
            if (!g) throw new Error("Guild not found.");
            return g;
        };

        this.registerTool("create_channel", {
            description: "Create a text, voice, or category channel",
            inputSchema: z.object({
                name: z.string(),
                type: z.enum(["text", "voice", "category"]).default("text"),
                category: z.string().optional(),
                nsfw: z.boolean().optional().describe("Whether the channel should be marked as NSFW (text channels only)"),
            }),
        }, (args) => this.createChannel(guild(), args));

        this.registerTool("delete_channel", {
            description: "Delete a channel by name or ID",
            inputSchema: z.object({ channel: z.string() }),
        }, (args) => this.deleteChannel(guild(), args));

        this.registerTool("create_role", {
            description: "Create a role",
            inputSchema: z.object({
                name: z.string(),
                color: z.string().optional(),
                mentionable: z.boolean().optional(),
                hoist: z.boolean().optional(),
            }),
        }, (args) => this.createRole(guild(), args));

        this.registerTool("delete_role", {
            description: "Delete a role — respects hierarchy and managed role rules",
            inputSchema: z.object({ role: z.string() }),
        }, (args) => this.deleteRole(guild(), args));

        this.registerTool("rename_server", {
            description: "Change the server name",
            inputSchema: z.object({ name: z.string() }),
        }, (args) => this.renameServer(guild(), args));
    }

    async start(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.connect(transport);
    }
}