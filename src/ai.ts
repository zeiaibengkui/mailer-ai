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

export async function proactiveChat(sender: string): Promise<string | null> {
    const history = loadHistory(sender);
    const exchangeCount = Math.floor(history.length / 2);

    // Gradually decreasing probability
    const prob = Math.exp(-exchangeCount * 0.3);
    if (Math.random() > prob) return null;

    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: prompt + "\n\n现在主动给主人发一条消息，关心一下主人或者找个话题聊天。" },
        ...history,
        { role: "user", content: "（主动找主人聊天）" },
    ];

    const reply = await client.chat.completions.create({
        model: "deepseek-chat",
        messages,
    });

    const text = reply.choices[0]?.message?.content;
    if (!text || text.includes("__SKIP__")) return null;

    history.push({ role: "assistant", content: text });
    saveHistory(sender, history);

    return text;
}
