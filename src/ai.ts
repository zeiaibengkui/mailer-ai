import OpenAI from "openai";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Character } from "./character.ts";

/** Shared DeepSeek client — the API key is global in .env, used by all characters. */
export const client = new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL,
    apiKey: process.env.DEEPSEEK_API_KEY,
});

function senderFile(char: Character, sender: string): string {
    const encoded = Buffer.from(sender, "utf-8").toString("base64");
    return `${char.dir}/senders/${encoded}.json`;
}

export function loadHistory(char: Character, sender: string): ChatCompletionMessageParam[] {
    const file = senderFile(char, sender);
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, "utf-8"));
}

export function saveHistory(char: Character, sender: string, history: ChatCompletionMessageParam[]) {
    mkdirSync(`${char.dir}/senders`, { recursive: true });
    writeFileSync(senderFile(char, sender), JSON.stringify(history, null, 2));
}

/** Register a sender so the proactive loop will pick them up, even before they email. */
export function ensureSender(char: Character, sender: string): boolean {
    const file = senderFile(char, sender);
    if (existsSync(file)) return false;
    mkdirSync(`${char.dir}/senders`, { recursive: true });
    writeFileSync(file, "[]");
    return true;
}

/** Prepend the current time so the AI always knows "now" when deciding to reply/schedule. */
export function withCurrentTime(content: string): string {
    const now = new Date();
    const local = now.toLocaleString("zh-CN", { hour12: false });
    return `当前时间: ${local} (${now.toISOString()})\n\n${content}`;
}

export async function chatWithHistory(
    char: Character,
    sender: string,
    content: string,
): Promise<string> {
    const history = loadHistory(char, sender);

    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: char.prompt },
        ...history,
        { role: "user", content: withCurrentTime(content) },
    ];

    const reply = await client.chat.completions.create({
        model: char.conf.bot.model,
        messages,
    });

    const text = reply.choices[0]?.message?.content ?? "__SKIP__";

    history.push({ role: "user", content });
    history.push({ role: "assistant", content: text });
    saveHistory(char, sender, history);

    return text;
}

export function extractReply(text: string): { subject: string; body: string; } | null {
    const lines = text.trim().split("\n");
    const filtered = lines.filter((l) => !/同意回复/.test(l));
    const subject = filtered[0];
    const body = filtered.slice(1).join("\n").trim();
    if (!subject) return null;
    return { subject, body };
}
