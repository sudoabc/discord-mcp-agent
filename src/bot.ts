import { Client, GatewayIntentBits, Partials, type ClientOptions } from "discord.js";

export default class MCPBot extends Client {
    constructor(options?: ClientOptions) {
        super({
            intents: Object.values(GatewayIntentBits).filter(
                (v) => typeof v === "number"
            ) as number[],
            partials: [
                Partials.Message,
                Partials.Channel,
                Partials.Reaction,
                Partials.User,
                Partials.GuildMember,
                Partials.ThreadMember,
                Partials.GuildScheduledEvent,
            ],
            presence: {
                activities: [
                    {
                        "name": "Make me do things through claude",
                        "type": 4
                    }
                ]
            },
            ...options
        });

        this.once("clientReady", async() => {
            console.error(`Logged in as ${this.user?.tag}!`);
        });
    }

    async start(): Promise<void> {
        const token = process.env.BOT_TOKEN;
        if (!token) 
            throw new Error("BOT_TOKEN is not set in environment");

        await this.login(token);
    }
}