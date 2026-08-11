import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { client, withCurrentTime } from "./ai.ts";
import type { Character } from "./character.ts";
import { normalizeSender } from "./sender.ts";

/** One entry in the character's long-term memory: when, about whom, and what. */
export type MemoryEntry = { at: string; sender: string; text: string };

/** Shared memory-extraction system prompt (prompts/memory.md); falls back to a default. */
const MEMORY_PROMPT_PATH = "prompts/memory.md";
const DEFAULT_MEMORY_PROMPT =
    "You are the memory keeper for this character. After every email you handle, decide " +
    "whether anything about this exchange is worth remembering long-term. Memory persists " +
    "across conversations with different people — it lets you recall what happened with one " +
    "person while talking to another.\n\n" +
    "Output exactly one of:\n" +
    "1. `__SKIP__` — nothing worth remembering.\n" +
    "2. A single short memory line — one durable fact, first person, no subject prefix. " +
    "Make clear who it concerns if not obvious (email address if needed). Write in the " +
    "language the character uses.\n\n" +
    "Only durable facts: relationships, plans, preferences, promises, problems. Not that a " +
    "routine exchange happened.";

function memoryFile(char: Character): string {
    return `${char.dir}/memory.md`;
}

/**
 * Read the memory file as entries. Each line is `- [<iso>] (<sender>) <text>`; text is
 * folded to one line on write, so one line = one entry. Latest entry is last.
 */
export function loadMemoryEntries(char: Character): MemoryEntry[] {
    const file = memoryFile(char);
    if (!existsSync(file)) return [];
    const entries: MemoryEntry[] = [];
    for (const line of readFileSync(file, "utf-8").split("\n")) {
        const m = line.match(/^- \[([^\]]+)\] \(([^)]+)\) (.*)$/);
        if (!m) continue;
        entries.push({ at: m[1], sender: m[2], text: m[3] });
    }
    return entries;
}

/** Append one memory entry, tagged with which person it's about. */
export function appendMemory(char: Character, sender: string, text: string): MemoryEntry {
    const entry: MemoryEntry = {
        at: new Date().toISOString(),
        sender: normalizeSender(sender),
        text: text.replace(/\s*\n\s*/g, " / ").trim(),
    };
    mkdirSync(char.dir, { recursive: true });
    writeFileSync(
        memoryFile(char),
        (existsSync(memoryFile(char)) ? readFileSync(memoryFile(char), "utf-8") : "") +
            `- [${entry.at}] (${entry.sender}) ${entry.text}\n`,
    );
    return entry;
}

/**
 * The memory block appended to every chat system prompt, so the character can recall
 * past exchanges with *other* people. Returns "" when there is no memory yet.
 */
export function memoryBlock(char: Character): string {
    const entries = loadMemoryEntries(char);
    if (entries.length === 0) return "";
    const lines = entries.map((e) => `- (${e.sender}) ${e.text}`).join("\n");
    return `\n\n你的长期记忆（与其他人的过往邮件，可跨会话参考）：\n${lines}`;
}

/** Read prompts/memory.md; falls back to a built-in default if the file is missing. */
function memoryPrompt(): string {
    if (!existsSync(MEMORY_PROMPT_PATH)) return DEFAULT_MEMORY_PROMPT;
    // Strip `#` heading lines (human labels) — only the prompt text reaches the model.
    return (
        readFileSync(MEMORY_PROMPT_PATH, "utf-8")
            .split("\n")
            .filter((l) => !/^#\s/.test(l))
            .join("\n")
            .trim() || DEFAULT_MEMORY_PROMPT
    );
}

/**
 * After a handled email, ask the model whether the exchange is worth remembering.
 * Returns the appended entry, or null when the model decided `__SKIP__`.
 */
export async function rememberExchange(
    char: Character,
    sender: string,
    emailText: string,
    replyText: string,
): Promise<MemoryEntry | null> {
    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: memoryPrompt() },
        {
            role: "user",
            content: withCurrentTime(
                `刚刚处理完一封来自 ${sender} 的邮件。\n\n收到的邮件：\n${emailText}\n\n` +
                    `你发出的回复：\n${replyText}\n\n` +
                    `如果有值得长期记住的事，输出记忆内容；否则输出 __SKIP__。`,
            ),
        },
    ];

    const reply = await client.chat.completions.create({
        model: char.conf.bot.model,
        messages,
    });

    const text = reply.choices[0]?.message?.content?.trim();
    if (!text || text.includes("__SKIP__")) return null;
    return appendMemory(char, sender, text);
}
