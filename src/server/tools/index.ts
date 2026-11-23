import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type MCPBot from "../../bot.js";
import { registerChannelTools } from "./channels.js";
import { registerGuildTools } from "./guild.js";
import { registerMessageTools } from "./messages.js";
import { registerRoleTools } from "./roles.js";

export function registerAllTools(server: McpServer, client: MCPBot): void {
    registerChannelTools(server, client);
    registerRoleTools(server, client);
    registerMessageTools(server, client);
    registerGuildTools(server, client);
}
