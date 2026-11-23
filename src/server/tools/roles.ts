import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PermissionFlagsBits, type ColorResolvable, type Guild } from "discord.js";
import { z } from "zod";
import type MCPBot from "../../bot.js";
import { getGuild } from "../context.js";
import { RequireHierarchy, RequirePermissions } from "../guards.js";
import { err, ok, type ToolResult } from "../types.js";

type CreateRoleArgs = {
        name: string;
        color?: string | undefined;
        mentionable?: boolean | undefined;
        hoist?: boolean | undefined;
};

class RoleTools {
    readonly client: MCPBot;

    constructor(client: MCPBot) {
        this.client = client;
    }

    @RequirePermissions(PermissionFlagsBits.ManageRoles)
    async createRole(guild: Guild, args: CreateRoleArgs): Promise<ToolResult> {
        const role = await guild.roles.create({
            name: args.name,
            mentionable: args.mentionable ?? false,
            hoist: args.hoist ?? false,
            reason: "Role created via MCP tool",
            ...(args.color ? { color: args.color as ColorResolvable } : {}),
        });

        return ok(`Created role "${role.name}" (ID: ${role.id})`);
    }

    @RequirePermissions(PermissionFlagsBits.ManageRoles)
    @RequireHierarchy<{ role: string; confirm: true }>((args) => args.role)
    async deleteRole(guild: Guild, args: { role: string; confirm: true }): Promise<ToolResult> {
        const target = guild.roles.cache.get(args.role);
        if (!target) {
            return err(`Role "${args.role}" not found.`);
        }

        await target.delete();
        return ok(`Deleted role "${target.name}"`);
    }
}

function viewRoles(guild: Guild): ToolResult {
    const roles = [...guild.roles.cache.values()]
        .sort((a, b) => a.position - b.position)
        .map((role) => ({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            position: role.position,
            permissions: role.permissions.toArray(),
            mentionable: role.mentionable,
            hoisted: role.hoist,
            managed: role.managed,
            editableByBot: role.editable,
            isEveryone: role.id === guild.id,
            memberCount: role.members.size,
            tags: role.tags ?? null,
            createdAt: new Date(role.createdTimestamp).toISOString(),
        }));

    return ok(JSON.stringify(roles));
}

export function registerRoleTools(server: McpServer, client: MCPBot): void {
    const tools = new RoleTools(client);

    server.registerTool("view_roles", {
        description: "View all roles and their IDs in the configured server.",
        inputSchema: z.object({}),
    }, () => viewRoles(getGuild(client)));

    server.registerTool("create_role", {
        description: "Create a server role",
        inputSchema: z.object({
            name: z.string()
                .describe("Name for the new role."),
            color: z.string().optional()
                .describe("Optional Discord role color, such as a hex value."),
            mentionable: z.boolean().optional()
                .describe("Whether users can mention this role."),
            hoist: z.boolean().optional()
                .describe("Whether members with this role are displayed separately in the member list."),
        }),
    }, (args) => tools.createRole(getGuild(client), args));

    server.registerTool("delete_role", {
        description: "Delete a role by ID after the user confirms. Use view_roles first to obtain the role ID.",
        inputSchema: z.object({
            role: z.string()
                .describe("Role ID (preferred). Use view_roles to look up IDs."),
            confirm: z.literal(true)
                .describe("Set to true to confirm this destructive operation."),
        }),
    }, (args) => tools.deleteRole(getGuild(client), args));
}
