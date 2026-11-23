# Discord MCP Bot

Discord MCP Bot is a local Model Context Protocol (MCP) server that lets an MCP-compatible AI client manage and interact with one configured Discord server through Discord bot APIs.

The project is built with TypeScript, discord.js, Zod, and the official MCP SDK. It uses stdio transport and is intended for local use with clients such as Claude Desktop or the MCP Inspector.

## Features

- Discord server, channel, role, and message tools
- Strict Discord permissions and role hierarchy guards
- Exact ID-based channel and role targeting
- Server-scoped message operations
- Rich message sending and editing
- Discord Components V2 support
- Embeds, polls, allowed mentions, replies, and reactions
- Confirmation requirements for destructive operations
- Modular tool registration under `src/server/tools`

## Available tools

### Guild

- `get_guild` - Get server information
- `update_guild` - Update server name, description, system/rules/AFK channels, AFK timeout, or premium progress bar settings

### Channels

- `view_channels` - List server channels and their IDs
- `create_channel` - Create text, voice, or category channels
- `delete_channel` - Delete a channel by ID

### Roles

- `view_roles` - List server roles and their IDs
- `create_role` - Create a role
- `delete_role` - Delete a role by ID

### Messages

- `read_messages` - Read recent messages from a channel
- `get_message` - Fetch an individual message by channel and message ID
- `send_message` - Send a message, embed, poll, Components V2 layout, or reply
- `edit_message` - Edit a message only when it was sent by this bot
- `add_reaction` - Add an emoji reaction
- `remove_reaction` - Remove the bot's reaction or all reactions
- `delete_message` - Delete a message by ID

The agent is directed to use `view_channels` and `view_roles` to obtain IDs before making targeted changes.

## Destructive confirmations

These tools require `confirm: true` after explicit user approval:

- `delete_channel`
- `delete_role`
- `delete_message`
- `update_guild`

The confirmation field has no default and is not set automatically by the server. The agent should ask the user to confirm before calling the tool.

No confirmation is required for:

- `edit_message`
- `add_reaction`
- `remove_reaction`

## Rich message support

`send_message` and `edit_message` support Discord message fields including:

- Text content
- Embeds
- Polls
- Allowed mentions
- Replies
- TTS
- Message nonce
- Components V2 layouts

Components V2 support includes:

- Text Display
- Section
- Thumbnail
- Media Gallery
- File
- Separator
- Container
- Action Row
- Buttons
- String Selects

When Components V2 are supplied, the server sets Discord's `IsComponentsV2` message flag. Components V2 messages cannot combine content or embeds with the components payload.

## Prerequisites

- Node.js 18 or newer
- A Discord application and bot
- A Discord server where the bot is a member
- The bot permissions needed for enabled operations

Recommended Discord permissions depend on the tools used:

- `ViewChannel`
- `ReadMessageHistory`
- `SendMessages`
- `ManageMessages`
- `AddReactions`
- `ManageChannels`
- `ManageRoles`
- `ManageGuild`

## Installation

```powershell
git clone https://github.com/sudoabc/discord-mcp-bot.git
cd discord-mcp-bot
npm install
```

Create `.env` from `.env.example`:

```env
BOT_TOKEN=your-discord-bot-token
DISCORD_SERVER_ID=your-discord-server-id
GUILD_ID=your-discord-server-id
```

`DISCORD_SERVER_ID` is preferred for server scoping. `GUILD_ID` is used as a fallback.

## Build and run

Compile the TypeScript source:

```powershell
npm run build
```

Run with the environment file through tsx:

```powershell
npm run dev
```

Run the compiled server with Node:

```powershell
node --env-file=.env build/index.js
```

## MCP Inspector

```powershell
npx @modelcontextprotocol/inspector node --env-file=.env build/index.js
```

The Inspector opens a local UI where available MCP tools and schemas can be tested.

## Claude Desktop configuration

Add the server to Claude Desktop's MCP configuration using absolute Windows paths:

```json
{
  "mcpServers": {
    "discord-agent": {
      "command": "node",
      "args": [
        "--env-file=C:/absolute/path/to/discord-mcp-bot/.env",
        "C:/absolute/path/to/discord-mcp-bot/build/index.js"
      ]
    }
  }
}
```

Restart Claude Desktop after changing its configuration.

## Project structure

```text
src/
  bot.ts
  index.ts
  server/
    context.ts
    guards.ts
    index.ts
    types.ts
    tools/
      channels.ts
      guild.ts
      messages.ts
      roles.ts
      index.ts
```

- `bot.ts` creates and logs in the Discord client
- `index.ts` starts the Discord client and MCP server
- `server/index.ts` creates the MCP server and connects stdio transport
- `server/tools/*` owns tool schemas and handlers by category
- `server/guards.ts` contains typed permission and role hierarchy decorators

## Usage examples

- "Show me the server channels."
- "Create a text channel called project-discussion."
- "Create a blue VIP role."
- "Read the latest 20 messages from the general channel."
- "Send an announcement with a button and a text display."
- "Edit the bot's most recent announcement."
- "Add a checkmark reaction to the latest message."
- "Delete message <message-id>, but first ask me to confirm."

## Safety notes

- Operations are restricted to `DISCORD_SERVER_ID`/`GUILD_ID`.
- Message operations verify the configured guild.
- Editing refuses messages that were not authored by the bot.
- Channel and role operations use exact IDs.
- Discord permissions are checked before protected actions.
- Destructive actions require explicit tool confirmation.

## License

MIT
