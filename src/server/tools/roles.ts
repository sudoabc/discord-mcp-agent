import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
    PermissionFlagsBits,
    type Guild,
    type RoleColorsResolvable,
    type RoleCreateOptions,
    type RoleEditOptions,
} from "discord.js";
import { z } from "zod";
import type MCPBot from "../../bot.js";
import { getGuild } from "../context.js";
import { RequireHierarchy, RequirePermissions } from "../guards.js";
import { err, ok, type ToolResult } from "../types.js";

type CreateRoleArgs = {
    name: string;
    permissions?: string | undefined;
    colors?: {
        primaryColor: string;
        secondaryColor?: string | undefined;
        tertiaryColor?: string | undefined;
    } | undefined;
    mentionable?: boolean | undefined;
    hoist?: boolean | undefined;
    reason?: string | undefined;
};

type UpdateRoleArgs = {
    role: string;
    name?: string | undefined;
    permissions?: string | undefined;
    colors?: {
        primaryColor?: string;
        secondaryColor?: string | undefined;
        tertiaryColor?: string | undefined;
    } | undefined;
    mentionable?: boolean | undefined;
    hoist?: boolean | undefined;
    position?: number | undefined;
    reason?: string | undefined;
}

const validPermissionBitfield = Object.values(PermissionFlagsBits).reduce(
    (combined, permission) => combined | BigInt(permission),
    0n,
);

function describePermissionFlags(): string {
    return Object.entries(PermissionFlagsBits)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(", ");
}

class RoleTools {
    readonly client: MCPBot;

    constructor(client: MCPBot) {
        this.client = client;
    }

    viewRoles(guild: Guild): ToolResult {
        const roles = [...guild.roles.cache.values()]
            .sort((a, b) => a.position - b.position)
            .map((role) => ({
                id: role.id,
                name: role.name,
                colors: role.colors,
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

    viewRole(guild: Guild, args: { role: string }): ToolResult {
        const role = guild.roles.cache.get(args.role);
        if (!role) return err(`Role "${args.role}" not found.`);

        const info = {
            id: role.id,
            name: role.name,
            colors: role.colors,
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
        }

        return ok(JSON.stringify(info));
    } 

    viewRoleMembers(guild: Guild, args: { role: string }): ToolResult {
        const role = guild.roles.cache.get(args.role);
        if (!role) return err(`Role "${args.role}" not found.`);

        const members = [...role.members.values()]
            .map((member) => ({
                id: member.id,
                username: member.user.username,
                discriminator: member.user.discriminator,
                displayName: member.displayName,
                nickname: member.nickname,
                clan: {
                    name: member.user.tag,
                    badgeUrl: member.user.guildTagBadgeURL({ size: 1024 })
                },
                moderatable: member.moderatable,
                roles: member.roles.cache.map((r) => ({ id: r.id, name: r.name })),
                joinedAt: member.joinedAt?.toISOString() ?? null,
                createdAt: member.user.createdAt.toISOString(),
                permissions: member.permissions.toArray(),
                avatarUrl: member.user.displayAvatarURL({ size: 1024 }),
                bannerUrl: member.user.bannerURL({ size: 1024 }),
                serverAvatarUrl: member.displayAvatarURL({ size: 1024 }),
                serverBannerUrl: member.user.bannerURL({ size: 1024 }),
                accentColor: member.user.accentColor,
                isOwner: member.id === guild.ownerId,
                isBot: member.user.bot,
                isTimedOut: member.isCommunicationDisabled(),
                isBoosting: member.premiumSince !== null,
                isMuted: member.voice?.serverMute ?? false,
                isDeafened: member.voice?.serverDeaf ?? false,
                isSelfMuted: member.voice?.selfMute ?? false,
                isSelfDeafened: member.voice?.selfDeaf ?? false,
                isSelfVideo: member.voice?.selfVideo ?? false,
                isStreaming: member.voice?.streaming ?? false,
                isSuppressed: member.voice?.suppress ?? false,
            }));

        return ok(JSON.stringify(members));
    }

    @RequirePermissions(PermissionFlagsBits.ManageRoles)
    async createRole(guild: Guild, args: CreateRoleArgs): Promise<ToolResult> {
        const patch: RoleCreateOptions = {
            name: args.name,
            mentionable: args.mentionable ?? false,
            hoist: args.hoist ?? false,
            reason: args.reason ?? "Role created via MCP tool",
        };

        if (args.permissions !== undefined)
            patch.permissions = BigInt(args.permissions);

        if (args.colors !== undefined)
            patch.colors = args.colors as RoleColorsResolvable;

        const role = await guild.roles.create(patch);
        return ok(`Created role "${role.name}" (ID: ${role.id})`);
    }

    @RequirePermissions(PermissionFlagsBits.ManageRoles)
    async updateRole(guild: Guild, args: UpdateRoleArgs): Promise<ToolResult> {
        const target = guild.roles.cache.get(args.role);
        if (!target) return err(`Role "${args.role}" not found.`);

        const patch: RoleEditOptions = {};
        const changed: string[] = [];

        if (args.name !== undefined) {
            patch.name = args.name;
            changed.push("name");
        }

        if (args.permissions !== undefined) {
            patch.permissions = BigInt(args.permissions);
            changed.push("permissions");
        }

        if (args.colors !== undefined) {
            patch.colors = args.colors as RoleColorsResolvable;
            changed.push("colors");
        }

        if (args.mentionable !== undefined) {
            patch.mentionable = args.mentionable;
            changed.push("mentionable");
        }

        if (args.hoist !== undefined) {
            patch.hoist = args.hoist;
            changed.push("hoist");
        }

        if (args.position !== undefined) {
            patch.position = args.position;
            changed.push("position");
        }

        if (args.reason !== undefined) patch.reason = args.reason;

        if (changed.length === 0) return err("No changes to apply.");
        await target.edit(patch);
        return ok(`Updated role "${target.name}" (${changed.join(", ")})`);
    }

    @RequirePermissions(PermissionFlagsBits.ManageRoles)
    @RequireHierarchy<{ role: string; confirm: boolean }>((args) => args.role)
    async deleteRole(guild: Guild, args: { role: string; confirm: boolean; reason?: string | undefined }): Promise<ToolResult> {
        if (!args.confirm) return err("action was not confirmed");

        const target = guild.roles.cache.get(args.role);
        if (!target) return err(`Role "${args.role}" not found.`);
        await target.delete(args.reason);
        return ok(`Deleted role "${target.name}"`);
    }
}

export function registerRoleTools(server: McpServer, client: MCPBot): void {
    const tools = new RoleTools(client);

    server.registerTool("view_roles", {
        description: "View all roles and their IDs in the configured server.",
        inputSchema: z.object({}),
    }, () => tools.viewRoles(getGuild(client)));

    server.registerTool("view_role", {
        description: "View detailed information about a role by ID.",
        inputSchema: z.object({
            role: z.string()
                .describe("Role ID (preferred). Use view_roles to look up IDs."),
        }),
    }, (args) => tools.viewRole(getGuild(client), args));

    server.registerTool("view_role_members", {
        description: "View all members with a specific role by ID.",
        inputSchema: z.object({
            role: z.string()
                .describe("Role ID (preferred). Use view_roles to look up IDs."),
        }),
    }, (args) => tools.viewRoleMembers(getGuild(client), args));

    server.registerTool("create_role", {
        description: "Create a server role",
        inputSchema: z.object({
            name: z.string()
                .describe("Name for the new role."),
            permissions: z.string()
                .regex(/^(0|[1-9][0-9]*)$/, "Permission bitfield must be a decimal integer string.")
                .refine(
                        (value: string) => (BigInt(value) & ~validPermissionBitfield) === 0n,
                        "Permission bitfield contains unknown permission flags.",
                )
                .describe(
                        "Optional permissions as a decimal bitwise-OR sum of permission values. "
                        + "For example, ViewChannel (1024) + SendMessages (2048) = \"3072\". "
                        + `Available Discord permission flags: ${describePermissionFlags()}. `
                        + "Never use names or hex values as the value; return only the resulting decimal string.",
                )
                .optional(),
            colors: z.object({
                primaryColor: z.string()
                    .describe("Primary role color as a hex value, integer, or Discord.js ColorResolvable."),
                secondaryColor: z.string().optional()
                    .describe("Optional secondary role gradient color."),
                tertiaryColor: z.string().optional()
                    .describe("Optional tertiary role gradient color."),
            }).optional()
                .describe("Optional enhanced role colors. The secondary and tertiary values create a gradient."),
            mentionable: z.boolean().optional()
                .describe("Whether users can mention this role."),
            hoist: z.boolean().optional()
                .describe("Whether members with this role are displayed separately in the member list."),
            reason: z.string().max(512).optional()
                .describe("Optional reason recorded in the Discord audit log."),
        }),
    }, (args) => tools.createRole(getGuild(client), args));

    server.registerTool("delete_role", {
        description: "Delete a role by ID after the user confirms. Use view_roles first to obtain the role ID.",
        inputSchema: z.object({
            role: z.string()
                .describe("Role ID (preferred). Use view_roles to look up IDs."),
            confirm: z.boolean()
                .describe("Set to true to confirm this destructive operation."),
            reason: z.string().max(512).optional()
                .describe("Optional reason recorded in the Discord audit log."),
        }),
    }, (args) => tools.deleteRole(getGuild(client), args));
}
