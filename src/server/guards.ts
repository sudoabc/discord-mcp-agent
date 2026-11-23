import { PermissionFlagsBits, type Guild } from "discord.js";
import type MCPBot from "../bot.js";
import { err, type ToolResult } from "./types.js";

type GuardContext = {
    client: MCPBot;
};

type GuardedMethod<TArgs> = (
    guild: Guild,
    args: TArgs,
) => Promise<ToolResult>;

export function RequirePermissions(...permissions: bigint[]) {
    return function <TArgs>(
        _target: object,
        _propertyKey: string,
        descriptor: TypedPropertyDescriptor<GuardedMethod<TArgs>>,
    ): TypedPropertyDescriptor<GuardedMethod<TArgs>> {
        const original = descriptor.value;
        if (!original) return descriptor;

        descriptor.value = async function (
            this: GuardContext,
            guild: Guild,
            args: TArgs,
        ): Promise<ToolResult> {
            if (!this.client.user) {
                return err("Bot is not logged in.");
            }

            const bot = guild.members.cache.get(this.client.user.id);
            if (!bot) {
                return err("Bot is not a member of this guild.");
            }

            const missing = permissions.filter((permission) => !bot.permissions.has(permission));
            if (missing.length === 0) {
                return await original.call(this, guild, args);
            }

            const names = missing.map(
                (permission) =>
                    Object.entries(PermissionFlagsBits).find(([, value]) => value === permission)?.[0] ??
                    String(permission),
            );

            return err(`Bot is missing permissions: ${names.join(", ")}`);
        };

        return descriptor;
    };
}

export function RequireHierarchy<TArgs>(
    getRoleRef: (args: TArgs) => string,
) {
    return function (
        _target: object,
        _propertyKey: string,
        descriptor: TypedPropertyDescriptor<GuardedMethod<TArgs>>,
    ): TypedPropertyDescriptor<GuardedMethod<TArgs>> {
        const original = descriptor.value;
        if (!original) return descriptor;

        descriptor.value = async function (
            this: GuardContext,
            guild: Guild,
            args: TArgs,
        ): Promise<ToolResult> {
            const roleRef = getRoleRef(args);
            const role = guild.roles.cache.get(roleRef);

            if (!role) {
                return err(`Role "${roleRef}" not found.`);
            }
            if (role.managed) {
                return err(`Role "${role.name}" is managed by an integration.`);
            }
            if (role.id === guild.id) {
                return err("Cannot target the @everyone role.");
            }

            const botTop = guild.members.cache.get(this.client.user!.id)?.roles.highest;
            if (!botTop) {
                return err("Could not determine bot's top role.");
            }
            if (role.position >= botTop.position) {
                return err(`Role "${role.name}" is at or above the bot's highest role.`);
            }

            return await original.call(this, guild, args);
        };

        return descriptor;
    };
}
