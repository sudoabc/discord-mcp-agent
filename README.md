# Discord Autonomous Agent via MCP

An open-source **Model Context Protocol (MCP)** server that empowers Anthropic's Claude to autonomously manage and orchestrate Discord servers using natural language. No slash commands, no rigid prefixes—just write what you want, and the agent executes it.

---

## Features

- **Zero-Command Architecture:** Driven entirely by Claude's reasoning capability via LLM function calling.
- **Channel Management:** Create text, voice, or category channels dynamically, respecting Discord's structural constraints.
- **Role Orchestration:** Generate and configure roles with hex colors, hoist options, and permissions.
- **Type-Safe & Secure:** Built with TypeScript, `discord.js` (v14+), and strict configuration handling (`exactOptionalPropertyTypes`).
- **Context-Aware Cache:** High-performance fallback system queries local memory first before hitting Discord APIs.

---

## Prerequisites

Before getting started, make sure you have:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A Discord Bot Token (with `Manage Channels` and `Manage Roles` bot permissions enabled in the Developer Portal)
- [Claude Desktop App](https://anthropic.com/claude/desktop) (for local integration)

---

## Installation

1. **Clone the repository & install dependencies:**
   ```bash
   git clone https://github.com/sudoabc/discord-mcp-agent.git
   cd discord-mcp-agent
   npm install
   ```

2. Create a **.env** file with the instructions from **.env.example**

3. Compile TypeScript to Javascript:
    ```bash
    npx tsc
    ```
    *This compiles the code from the ./src directory into the output ./build directory.*

---

## Running the MCP Server

### Option A - Via MCP Inspector (Web UI)

Anthropic provides an excellent debugging tool. Run this command to boot up the server alongside a browser interface:

```bash
npx @modelcontextprotocol/inspector node --env-file=.env build/index.js
```

Open the local URL provided in your terminal to view, trigger, and debug your tools (createChannel, createRole) via a clean UI.

### Option B - Connecting to Claude Desktop

To let Claude use this agent natively in your chat sessions, you need to add it to your local Claude configuration file.

1. Open `claude_desktop_config.json` located at:
   - Windows: `%appdata%\Claude\claude_desktop_config.json`
   - MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the server configuration under `mcpServers`. Make sure to use **absolute paths** and the native `--env-file` flag:

    ```json
    {
        "mcpServers": {
            "discord-agent": {
                "command": "node",
                "args": [
                    "--env-file=C:/absolute/path/to/your/project/.env",
                    "C:/absolute/path/to/your/project/build/index.js"
                ]
            }
        }
    }
    ```

*Note: On Windows, use forward slashes (/) or double backslashes (\\) in JSON paths.*

3. Restart **Claude Desktop** completely.

---

## Usage Examples

Once connected, you can talk to Claude like a human server administrator:
- *"Create 5 text channels named 'project-discussion' inside the general category."*
- *"Make a new role called VIP with a blue color and make it hoistable."*

> [!NOTE]
> This project currently operates exclusively via **Stdio Transport** for local execution. 
> **SSE (Server-Sent Events) support for cloud deployment is actively planned for the next release.**

---

## License

This project is licensed under the MIT License.

---
