import { Guild, PermissionFlagsBits } from "discord.js";
import MCPBot from "./bot.js";

type ToolHandler<T> = (args: T) => Promise<{ content: { type: "text"; text: string }[] }>;
const err = (text: string) => ({ content: [{ type: "text" as const, text: `❌ ${text}` }] });

export function RequirePermissions(...permissions: bigint[]) {
  return function <T>(
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(guild: Guild, args: T) => ReturnType<ToolHandler<T>>>
  ) {
    const original = descriptor.value!;

    descriptor.value = async function (this: { client: MCPBot }, guild: Guild, args: T) {
      const bot = guild.members.cache.get(this.client.user!.id);
      if (!bot) return err("Bot is not a member of this guild.");

      const missing = permissions.filter((p) => !bot.permissions.has(p));
      if (missing.length > 0) {
        const names = missing.map(
          (p) => Object.entries(PermissionFlagsBits).find(([, v]) => v === p)?.[0] ?? String(p)
        );
        return err(`Bot is missing permissions: ${names.join(", ")}`);
      }

      return original.call(this, guild, args);
    };

    return descriptor;
  };
}

export function RequireHierarchy(getRoleId: (args: any) => string) {
  return function (
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>
  ) {
    const original = descriptor.value!;

    descriptor.value = async function (this: { client: MCPBot }, guild: Guild, args: any) {
      const roleId = getRoleId(args);
      const role = guild.roles.cache.find((r) => r.name === roleId || r.id === roleId);

      if (!role) return err(`Role "${roleId}" not found.`);
      if (role.managed) return err(`Role "${role.name}" is managed by an integration.`);
      if (role.id === guild.id) return err(`Cannot target the @everyone role.`);

      const botTop = guild.members.cache.get(this.client.user!.id)?.roles.highest;
      if (!botTop) return err("Could not determine bot's top role.");
      if (role.position >= botTop.position) {
        return err(`Role "${role.name}" is at or above the bot's highest role.`);
      }

      return original.call(this, guild, args);
    };

    return descriptor;
  };
}