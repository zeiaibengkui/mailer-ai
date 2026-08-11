import OpenAI from "openai";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
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

/** URL-safe sender id for use in paths (on-disk filenames use standard base64, which can contain `/`/`+`). */
export function encodeSenderId(sender: string): string {
    return Buffer.from(sender, "utf-8").toString("base64url");
}

export function decodeSenderId(id: string): string {
    return Buffer.from(id, "base64url").toString("utf-8");
}

/** List a character's known senders: { id, sender, exchanges } — id is the URL-safe key. */
export function listSenders(char: Character): { id: string; sender: string; exchanges: number }[] {
    const dir = `${char.dir}/senders`;
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
            const sender = Buffer.from(f.slice(0, -5), "base64").toString("utf-8");
            const history = loadHistory(char, sender);
            return { id: encodeSenderId(sender), sender, exchanges: Math.floor(history.length / 2) };
        });
}

/** Delete a sender's history file (their conversation with this character). */
export function deleteSender(char: Character, sender: string) {
    const file = senderFile(char, sender);
    if (existsSync(file)) unlinkSync(file);
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
