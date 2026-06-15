import MCPServer from "./server.js";
import MCPBot from "./bot.js";

const client = new MCPBot();
const server = new MCPServer(client);

async function main() {
    console.error("Starting Discord Bot...");
    await client.start();
    console.error("Starting MCP Server...");
    await server.start();
    console.error("Discord Bot and MCP Server are running.");
}

main()
.catch((err) => {
    console.error(err);
    process.exit(1);
});