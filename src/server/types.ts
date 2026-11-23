export type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
};

export const ok = (text: string): ToolResult => ({
    content: [{ type: "text", text }],
});

export const err = (text: string): ToolResult => ({
    content: [{ type: "text", text: `Ã¢ÂÅ’ ${text}` }],
});
