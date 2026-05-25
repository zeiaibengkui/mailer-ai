import OpenAI from "openai";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const prompt = readFileSync("data/prompt.txt", "utf-8");

export const client = new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL,
    apiKey: process.env.DEEPSEEK_API_KEY,
});

const SENDERS_DIR = "data/senders";

function senderFile(sender: string): string {
    const encoded = Buffer.from(sender, "utf-8").toString("base64");
    return `${SENDERS_DIR}/${encoded}.json`;
}

export function loadHistory(sender: string): ChatCompletionMessageParam[] {
    const file = senderFile(sender);
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, "utf-8"));
}

export function saveHistory(sender: string, history: ChatCompletionMessageParam[]) {
    mkdirSync(SENDERS_DIR, { recursive: true });
    writeFileSync(senderFile(sender), JSON.stringify(history, null, 2));
}

export async function chatWithHistory(
    sender: string,
    content: string,
): Promise<string> {
    const history = loadHistory(sender);

    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: prompt },
        ...history,
        { role: "user", content },
    ];

    const reply = await client.chat.completions.create({
        model: "deepseek-chat",
        messages,
    });

    const text = reply.choices[0]?.message?.content ?? "__SKIP__";

    history.push({ role: "user", content });
    history.push({ role: "assistant", content: text });
    saveHistory(sender, history);

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

