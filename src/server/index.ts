import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type MCPBot from "../bot.js";
import { registerAllTools } from "./tools/index.js";

export default class MCPServer extends McpServer {
    readonly client: MCPBot;

    constructor(client: MCPBot) {
        super({ name: "discord-mcp", version: "1.0.0" });
        this.client = client;
        registerAllTools(this, client);
    }

    async start(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.connect(transport);
    }
}
