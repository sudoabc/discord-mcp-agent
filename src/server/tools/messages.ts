import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
    PermissionFlagsBits,
    MessageFlags,
    type APIEmbed,
    type APIMessageTopLevelComponent,
    type Guild,
    type Message,
    type MessageCreateOptions,
    type MessageEditOptions,
    type MessageMentionOptions,
    type PollData,
} from "discord.js";
import { z } from "zod";
import type MCPBot from "../../bot.js";
import { getGuild, getGuildId } from "../context.js";
import { RequirePermissions } from "../guards.js";
import { err, ok, type ToolResult } from "../types.js";

const allowedMentionsSchema = z.object({
    parse: z.array(z.enum(["roles", "users", "everyone"]))
        .optional()
        .describe("Mention types Discord should parse automatically."),
    roles: z.array(z.string())
        .optional()
        .describe("Role IDs that may be mentioned."),
    users: z.array(z.string())
        .optional()
        .describe("User IDs that may be mentioned."),
    repliedUser: z.boolean()
        .optional()
        .describe("Whether a reply should mention the referenced message author."),
});

const embedFieldSchema = z.object({
    name: z.string().describe("Embed field label."),
    value: z.string().describe("Embed field text."),
    inline: z.boolean().optional().describe("Whether this field should appear inline."),
});

const embedSchema = z.object({
    title: z.string().optional().describe("Embed title."),
    description: z.string().optional().describe("Main embed text."),
    url: z.url().optional().describe("URL opened when the embed title is clicked."),
    timestamp: z.iso.datetime().optional().describe("ISO 8601 timestamp shown in the embed."),
    color: z.number().int().min(0).max(0xffffff).optional()
        .describe("Embed accent color as a 24-bit integer."),
    fields: z.array(embedFieldSchema).optional().describe("Additional labeled embed fields."),
    footer: z.object({
        text: z.string().describe("Footer text."),
        icon_url: z.url().optional().describe("Footer icon URL."),
    }).optional().describe("Embed footer."),
    image: z.object({ url: z.url().describe("Large image URL.") }).optional()
        .describe("Large image displayed in the embed."),
    thumbnail: z.object({ url: z.url().describe("Thumbnail image URL.") }).optional()
        .describe("Small image displayed beside the embed."),
    author: z.object({
        name: z.string().describe("Author name."),
        url: z.url().optional().describe("Author URL."),
        icon_url: z.url().optional().describe("Author icon URL."),
    }).optional().describe("Embed author."),
});

const mediaSchema = z.object({
    url: z.url().describe("URL of the media item."),
});

const emojiSchema = z.object({
    id: z.string().optional().describe("Guild emoji ID."),
    name: z.string().optional().describe("Unicode emoji or custom emoji name."),
    animated: z.boolean().optional().describe("Whether a custom emoji is animated."),
}).refine((emoji) => emoji.id !== undefined || emoji.name !== undefined, {
    message: "Provide an emoji id or name.",
});

const buttonSchema = z.object({
    type: z.literal(2).describe("Component type: 2 for button."),
    id: z.number().int().min(1).optional().describe("Optional unique component ID."),
    style: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
    ]),
    label: z.string().max(80).optional().describe("Button text."),
    emoji: emojiSchema.optional().describe("Optional emoji shown on the button."),
    custom_id: z.string().min(1).max(100).optional()
        .describe("ID returned for an interactive button."),
    url: z.url().optional().describe("URL for a link button."),
    disabled: z.boolean().optional().describe("Whether the button is disabled."),
}).refine(
    (button) => button.style === 5 ? button.url !== undefined : button.custom_id !== undefined,
    { message: "Link buttons require url; interactive buttons require custom_id." },
);

const stringSelectSchema = z.object({
    type: z.literal(3).describe("Component type: 3 for string select."),
    id: z.number().int().min(1).optional().describe("Optional unique component ID."),
    custom_id: z.string().min(1).max(100).describe("ID returned when an option is selected."),
    placeholder: z.string().max(150).optional().describe("Text shown when no value is selected."),
    min_values: z.number().int().min(0).max(25).optional()
        .describe("Minimum number of selections."),
    max_values: z.number().int().min(1).max(25).optional()
        .describe("Maximum number of selections."),
    disabled: z.boolean().optional().describe("Whether the select is disabled."),
    options: z.array(z.object({
        label: z.string().min(1).max(100).describe("Visible option label."),
        value: z.string().min(1).max(100).describe("Value returned when selected."),
        description: z.string().max(100).optional().describe("Optional option description."),
        emoji: emojiSchema.optional().describe("Optional option emoji."),
        default: z.boolean().optional().describe("Whether this option is selected by default."),
    }).describe("String select option")).min(1).max(25)
        .describe("Available string select options."),
});

const actionRowSchema = z.object({
    type: z.literal(1).describe("Component type: 1 for action row."),
    id: z.number().int().min(1).optional().describe("Optional unique component ID."),
    components: z.array(z.union([buttonSchema, stringSelectSchema])).min(1).max(5)
        .describe("Interactive components in this row."),
});

const textDisplaySchema = z.object({
    type: z.literal(10).describe("Component type: 10 for text display."),
    id: z.number().int().min(1).optional().describe("Optional unique component ID."),
    content: z.string().min(1).max(4000).describe("Markdown text to display."),
});

const thumbnailSchema = z.object({
    type: z.literal(11).describe("Component type: 11 for thumbnail."),
    id: z.number().int().min(1).optional().describe("Optional unique component ID."),
    media: mediaSchema.describe("Thumbnail media."),
    description: z.string().max(1024).optional().describe("Accessibility description."),
    spoiler: z.boolean().optional().describe("Whether the thumbnail is hidden as a spoiler."),
});

const mediaGallerySchema = z.object({
    type: z.literal(12).describe("Component type: 12 for media gallery."),
    id: z.number().int().min(1).optional().describe("Optional unique component ID."),
    items: z.array(z.object({
        media: mediaSchema.describe("Gallery media."),
        description: z.string().max(1024).optional().describe("Accessibility description."),
        spoiler: z.boolean().optional().describe("Whether this item is hidden as a spoiler."),
    })).min(1).max(10).describe("Gallery items."),
});

const fileSchema = z.object({
    type: z.literal(13).describe("Component type: 13 for file."),
    id: z.number().int().min(1).optional().describe("Optional unique component ID."),
    file: mediaSchema.describe("File media reference."),
    spoiler: z.boolean().optional().describe("Whether the file is hidden as a spoiler."),
});

const separatorSchema = z.object({
    type: z.literal(14).describe("Component type: 14 for separator."),
    id: z.number().int().min(1).optional().describe("Optional unique component ID."),
    divider: z.boolean().optional().describe("Whether to draw a divider."),
    spacing: z.union([z.literal(1), z.literal(2)]).optional()
        .describe("Separator spacing: 1 small or 2 large."),
});

const sectionSchema = z.object({
    type: z.literal(9).describe("Component type: 9 for section."),
    id: z.number().int().min(1).optional().describe("Optional unique component ID."),
    components: z.array(textDisplaySchema).min(1).max(3)
        .describe("Text displays inside the section."),
    accessory: z.union([buttonSchema, thumbnailSchema])
        .describe("Thumbnail or button shown beside the section."),
});

const containerSchema = z.object({
    type: z.literal(17).describe("Component type: 17 for container."),
    id: z.number().int().min(1).optional().describe("Optional unique component ID."),
    components: z.array(z.union([
        actionRowSchema,
        textDisplaySchema,
        sectionSchema,
        mediaGallerySchema,
        fileSchema,
        separatorSchema,
    ])).min(1).max(40).describe("Components grouped inside the container."),
    accent_color: z.number().int().min(0).max(0xffffff).optional()
        .describe("Container accent color as a 24-bit integer."),
    spoiler: z.boolean().optional().describe("Whether the container is hidden as a spoiler."),
});

const componentsV2Schema = z.array(z.union([
    actionRowSchema,
    textDisplaySchema,
    sectionSchema,
    mediaGallerySchema,
    fileSchema,
    separatorSchema,
    containerSchema,
])).min(1).max(40);

const pollSchema = z.object({
    question: z.object({
        text: z.string().min(1).max(300).describe("Poll question."),
    }),
    answers: z.array(z.object({
        text: z.string().min(1).max(55).describe("Poll answer text."),
        emoji: z.string().optional().describe("Optional emoji for this answer."),
    })).min(1).max(10).describe("Poll answer choices."),
    duration: z.number().int().min(1).max(32).describe("Poll duration in hours."),
    allowMultiselect: z.boolean().describe("Whether users can select multiple answers."),
});

const sendMessageSchema = z.object({
    channel: z.string()
        .describe("Channel ID. Use view_channels to look up the ID."),
    content: z.string().max(2000).optional().describe("Plain text message content."),
    embeds: z.array(embedSchema).max(10).optional().describe("Discord rich embeds."),
    components: componentsV2Schema.optional()
        .describe("Components V2 layout objects. Supports text display, section, thumbnail, media gallery, file, separator, and container components."),
    allowedMentions: allowedMentionsSchema.optional()
        .describe("Controls which parsed or explicit mentions are allowed."),
    poll: pollSchema.nullish()
        .describe("Poll to attach to the message. Omit or set to null when no poll is intended."),
    tts: z.boolean().optional().describe("Whether Discord should read the message aloud."),
    nonce: z.union([z.string(), z.number()]).optional()
        .describe("Optional request nonce used for duplicate-safe message creation."),
    enforceNonce: z.boolean().optional()
        .describe("Whether Discord should enforce nonce deduplication."),
    reference: z.string().optional()
        .describe("Message ID to reply to. Use get_message or read_messages to look it up."),
}).refine(
    (args) =>
        args.content !== undefined ||
        (args.embeds?.length ?? 0) > 0 ||
        (args.components?.length ?? 0) > 0 ||
        args.poll !== undefined,
    { message: "Provide content, embeds, components, or a poll." },
).refine(
    (args) =>
        args.components === undefined ||
        (args.content === undefined && args.embeds === undefined && args.poll === undefined),
    { message: "Components V2 cannot be combined with content, embeds, stickers, or a poll." },
);

const editMessageSchema = z.object({
    channel: z.string()
        .describe("Channel ID. Use view_channels to look up the ID."),
    message: z.string()
        .describe("Message ID. Use get_message or read_messages to look it up."),
    content: z.string().max(2000).nullable().optional()
        .describe("Replacement text content; null clears text."),
    embeds: z.array(embedSchema).max(10).optional()
        .describe("Replacement embeds."),
    components: componentsV2Schema.optional()
        .describe("Components V2 layout objects."),
    allowedMentions: allowedMentionsSchema.optional()
        .describe("Controls which users, roles, or everyone mentions are allowed."),
});

const reactionSchema = z.object({
    channel: z.string()
        .describe("Channel ID. Use view_channels to look up the ID."),
    message: z.string()
        .describe("Message ID. Use get_message or read_messages to look it up."),
    emoji: z.string()
        .describe("Unicode emoji or guild emoji identifier such as 123456789012345678."),
});

const removeReactionSchema = z.object({
    channel: z.string()
        .describe("Channel ID. Use view_channels to look up the ID."),
    message: z.string()
        .describe("Message ID. Use get_message or read_messages to look it up."),
    emoji: z.string().optional()
        .describe("Optional Unicode emoji or guild emoji identifier. Omit to remove every reaction."),
});

const deleteMessageSchema = z.object({
    channel: z.string()
        .describe("Channel ID. Use view_channels to look up the ID."),
    message: z.string()
        .describe("Message ID. Use get_message or read_messages to look it up."),
    confirm: z.literal(true)
        .describe("Set to true to confirm deleting this message."),
});

class MessageTools {
    readonly client: MCPBot;

    constructor(client: MCPBot) {
        this.client = client;
    }

    private ensureGuildMessage(guild: Guild, messageGuildId: string | null): ToolResult | null {
        if (messageGuildId !== guild.id || guild.id !== getGuildId()) 
            return err("Message does not belong to the configured Discord server.");

        return null;
    }

    @RequirePermissions(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages)
    async sendMessage(
        guild: Guild,
        args: z.infer<typeof sendMessageSchema>,
    ): Promise<ToolResult> {
        const channel = guild.channels.cache.get(args.channel);
        if (!channel) return err(`Channel "${args.channel}" not found.`);
        if (!("send" in channel)) return err(`Channel "${args.channel}" is not a chattable channel.`);

        const payload: MessageCreateOptions = {
            ...(args.content !== undefined ? { content: args.content } : {}),
            ...(args.embeds ? { embeds: args.embeds as APIEmbed[] } : {}),
            ...(args.components
                ? { components: args.components as APIMessageTopLevelComponent[] }
                : {}),
            ...(args.allowedMentions
                ? { allowedMentions: args.allowedMentions as MessageMentionOptions }
                : {}),
            ...(args.poll ? { poll: args.poll as PollData } : {}),
            ...(args.tts !== undefined ? { tts: args.tts } : {}),
            ...(args.nonce !== undefined ? { nonce: args.nonce } : {}),
            ...(args.enforceNonce !== undefined ? { enforceNonce: args.enforceNonce } : {}),
            ...(args.components ? { flags: MessageFlags.IsComponentsV2 } : {}),
        };

        if (args.reference) {
            const repliedTo = await channel.messages.fetch(args.reference).catch(() => null);
            if (!repliedTo) return err(`Message "${args.reference}" not found.`);
            if (repliedTo.guildId !== guild.id) 
                return err("The referenced message does not belong to the configured Discord server.");

            await repliedTo.reply({
                ...payload,
                failIfNotExists: false,
            });
        } else {
            await channel.send(payload);
        }

        return ok(`Sent message in ${channel.name}`);
    }

    @RequirePermissions(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory)
    async readMessages(
        guild: Guild,
        args: { channel: string; limit?: number | undefined },
    ): Promise<ToolResult> {
        const channel = guild.channels.cache.get(args.channel);
        if (!channel) return err(`Channel "${args.channel}" not found.`);
        if (!("messages" in channel)) return err(`Channel "${args.channel}" is not a chattable channel.`);

        const messages = await channel.messages.fetch({
            limit: Math.min(args.limit ?? 10, 100),
        });
        return ok(JSON.stringify([...messages.values()].map((message) => this.serializeMessage(message))));
    }

    @RequirePermissions(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory)
    async getMessage(
        guild: Guild,
        args: { channel: string; message: string },
    ): Promise<ToolResult> {
        const channel = guild.channels.cache.get(args.channel);
        if (!channel) return err(`Channel "${args.channel}" not found.`);
        if (!("messages" in channel)) return err(`Channel "${args.channel}" is not a chattable channel.`);

        const message = await channel.messages.fetch(args.message).catch(() => null);
        if (!message) return err(`Message "${args.message}" not found.`);

        const guildError = this.ensureGuildMessage(guild, message.guildId);
        if (guildError) return guildError;

        return ok(JSON.stringify(this.serializeMessage(message)));
    }

    @RequirePermissions(PermissionFlagsBits.ViewChannel)
    async editMessage(
        guild: Guild,
        args: z.infer<typeof editMessageSchema>,
    ): Promise<ToolResult> {
        const channel = guild.channels.cache.get(args.channel);
        if (!channel) return err(`Channel "${args.channel}" not found.`);
        if (!("messages" in channel)) return err(`Channel "${args.channel}" is not a chattable channel.`);

        const message = await channel.messages.fetch(args.message).catch(() => null);
        if (!message) return err(`Message "${args.message}" not found.`);

        const guildError = this.ensureGuildMessage(guild, message.guildId);
        if (guildError) return guildError;
        if (!this.client.user || message.author.id !== this.client.user.id)
            return err("This message was not sent by the bot and cannot be edited.");

        const payload: MessageEditOptions = {
            ...(args.content !== undefined ? { content: args.content } : {}),
            ...(args.embeds ? { embeds: args.embeds as APIEmbed[] } : {}),
            ...(args.components
                ? { components: args.components as APIMessageTopLevelComponent[] }
                : {}),
            ...(args.allowedMentions
                ? { allowedMentions: args.allowedMentions as MessageMentionOptions }
                : {}),
            ...(args.components ? { flags: MessageFlags.IsComponentsV2 } : {}),
        };

        await message.edit(payload);
        return ok(`Edited message "${message.id}"`);
    }

    @RequirePermissions(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.AddReactions)
    async addReaction(
        guild: Guild,
        args: z.infer<typeof reactionSchema>,
    ): Promise<ToolResult> {
        const channel = guild.channels.cache.get(args.channel);
        if (!channel) return err(`Channel "${args.channel}" not found.`);
        if (!("messages" in channel)) return err(`Channel "${args.channel}" is not a chattable channel.`);

        const message = await channel.messages.fetch(args.message).catch(() => null);
        if (!message) return err(`Message "${args.message}" not found.`);

        const guildError = this.ensureGuildMessage(guild, message.guildId);
        if (guildError) return guildError;

        await message.react(args.emoji);
        return ok(`Added reaction "${args.emoji}" to message "${message.id}"`);
    }

    @RequirePermissions(PermissionFlagsBits.ViewChannel)
    async removeReaction(
        guild: Guild,
        args: z.infer<typeof removeReactionSchema>,
    ): Promise<ToolResult> {
        const channel = guild.channels.cache.get(args.channel);
        if (!channel) return err(`Channel "${args.channel}" not found.`);
        if (!("messages" in channel)) return err(`Channel "${args.channel}" is not a chattable channel.`);

        const message = await channel.messages.fetch(args.message).catch(() => null);
        if (!message) return err(`Message "${args.message}" not found.`);

        const guildError = this.ensureGuildMessage(guild, message.guildId);
        if (guildError) return guildError;

        if (!args.emoji) {
            await message.reactions.removeAll();
            return ok(`Removed every reaction from message "${message.id}"`);
        }

        const reaction = message.reactions.cache.find(
            (candidate) => candidate.emoji.toString() === args.emoji,
        );
        if (!reaction) return err(`Reaction "${args.emoji}" not found.`);

        await reaction.users.remove("@me");
        return ok(`Removed bot reaction "${args.emoji}" from message "${message.id}"`);
    }

    @RequirePermissions(PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageMessages)
    async deleteMessage(
        guild: Guild,
        args: z.infer<typeof deleteMessageSchema>,
    ): Promise<ToolResult> {
        const channel = guild.channels.cache.get(args.channel);
        if (!channel) return err(`Channel "${args.channel}" not found.`);
        if (!("messages" in channel)) return err(`Channel "${args.channel}" is not a chattable channel.`);

        const message = await channel.messages.fetch(args.message).catch(() => null);
        if (!message) return err(`Message "${args.message}" not found.`);

        const guildError = this.ensureGuildMessage(guild, message.guildId);
        if (guildError) return guildError;

        await channel.messages.delete(args.message);
        return ok(`Deleted message "${args.message}"`);
    }

    private serializeMessage(message: Message) {
        return {
            id: message.id,
            channelId: message.channelId,
            guildId: message.guildId,
            author: {
                id: message.author.id,
                username: message.author.username,
                bot: message.author.bot,
            },
            content: message.content,
            tts: message.tts,
            pinned: message.pinned,
            createdAt: message.createdAt.toISOString(),
            editedAt: message.editedAt?.toISOString() ?? null,
            url: message.url,
            embeds: message.embeds.map((embed) => embed.toJSON()),
            components: message.components.map((component) => component.toJSON()),
            attachments: [...message.attachments.values()].map((attachment) => ({
                id: attachment.id,
                name: attachment.name,
                url: attachment.url,
                contentType: attachment.contentType,
                size: attachment.size,
            })),
            reactions: [...message.reactions.cache.values()].map((reaction) => ({
                emoji: reaction.emoji.toString(),
                count: reaction.count,
                me: reaction.me,
            })),
            poll: message.poll?.toJSON() ?? null,
        };
    }

}

export function registerMessageTools(server: McpServer, client: MCPBot): void {
    const tools = new MessageTools(client);

    server.registerTool("send_message", {
        description: "Send a rich message. Use view_channels first to obtain the exact channel ID.",
        inputSchema: sendMessageSchema,
    }, (args) => tools.sendMessage(getGuild(client), args));

    server.registerTool("read_messages", {
        description: "Read recent messages from a channel. Use view_channels first to obtain the exact channel ID.",
        inputSchema: z.object({
            channel: z.string()
                .describe("Channel ID. Use view_channels to look up the ID."),
            limit: z.number().int().min(1).max(100).optional().default(10)
                .describe("Number of recent messages to fetch, from 1 to 100."),
        }),
    }, (args) => tools.readMessages(getGuild(client), args));

    server.registerTool("get_message", {
        description: "Fetch one message by exact channel ID and message ID.",
        inputSchema: z.object({
            channel: z.string()
                .describe("Channel ID. Use view_channels to look up the ID."),
            message: z.string()
                .describe("Message ID."),
        }),
    }, (args) => tools.getMessage(getGuild(client), args));

    server.registerTool("edit_message", {
        description: "Edit a bot-owned message. Use get_message to verify ownership and get IDs.",
        inputSchema: editMessageSchema,
    }, (args) => tools.editMessage(getGuild(client), args));

    server.registerTool("add_reaction", {
        description: "Add a Unicode emoji or guild emoji reaction to a message.",
        inputSchema: reactionSchema,
    }, (args) => tools.addReaction(getGuild(client), args));

    server.registerTool("remove_reaction", {
        description: "Remove the bot's reaction by emoji, or remove every reaction when emoji is omitted.",
        inputSchema: removeReactionSchema,
    }, (args) => tools.removeReaction(getGuild(client), args));

    server.registerTool("delete_message", {
        description: "Delete a message by exact ID after the user confirms.",
        inputSchema: deleteMessageSchema,
    }, (args) => tools.deleteMessage(getGuild(client), args));
}
