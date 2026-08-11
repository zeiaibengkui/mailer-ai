import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { client, withCurrentTime, loadHistory } from "./ai.ts";
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
    "2. A memory line — one durable fact, first person, no subject prefix. Make clear who " +
    "it concerns if not obvious (email address if needed). Write in the language the " +
    "character uses.\n\n" +
    "If there is no existing memory about this person yet, this is the moment to write the " +
    "first one: who they are (identity, background) and what they are like (personality, " +
    "how they relate to you) — at minimum one line, so you recognize them later. Then keep " +
    "adding durable facts about people: relationships, plans, preferences, promises, " +
    "problems.\n\n" +
    "Do not record that a routine exchange happened. Do record who the person is and what " +
    "they are like.";

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

/** Remove the memory entry with the given `at` timestamp. Returns false if none matched. */
export function removeMemoryEntry(char: Character, at: string): boolean {
    const entries = loadMemoryEntries(char);
    const remaining = entries.filter((e) => e.at !== at);
    if (remaining.length === entries.length) return false;
    mkdirSync(char.dir, { recursive: true });
    writeFileSync(
        memoryFile(char),
        remaining.map((e) => `- [${e.at}] (${e.sender}) ${e.text}\n`).join(""),
    );
    return true;
}

/** Wipe all of a character's long-term memory. */
export function clearMemory(char: Character) {
    mkdirSync(char.dir, { recursive: true });
    writeFileSync(memoryFile(char), "");
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
 * After a handled email, ask the memory keeper whether anything is worth remembering.
 * The keeper sees the recent conversation with this person and any existing memory
 * about them, so it can recognize a first meeting (and write an identity/personality
 * memory) versus a continuation (a new durable fact, or `__SKIP__`).
 * Returns the appended entry, or null when the model decided `__SKIP__`.
 */
export async function rememberExchange(
    char: Character,
    sender: string,
): Promise<MemoryEntry | null> {
    const history = loadHistory(char, sender);
    const known = loadMemoryEntries(char).filter((e) => e.sender === normalizeSender(sender));
    const memoryCtx =
        known.length === 0
            ? "\n关于这个人还没有任何记忆。"
            : "\n关于这个人的现有记忆：\n" + known.map((e) => `- ${e.text}`).join("\n");

    // Recent transcript gives the keeper the context a single exchange lacks — who this
    // person is and how the conversation has been going.
    const transcript = history
        .slice(-12)
        .map((m) => (m.role === "assistant" ? "你" : "对方") + `：${m.content}`)
        .join("\n\n");

    // If this is the first time we could remember someone and the character actually
    // engaged with them (didn't `__SKIP__` the reply), require a first identity/personality
    // memory — otherwise the keeper keeps erring toward "nothing durable" and the person
    // stays unknown. `__SKIP__` stays allowed for spam and for continuations.
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    const engaged = !String(lastAssistant?.content ?? "").includes("__SKIP__");
    const forceFirst = known.length === 0 && engaged;
    const forceNote = forceFirst
        ? "\n\n这是你们之间的第一次记录。**不要输出 __SKIP__**——你必须写一条记忆，至少包含：这个人是谁（身份/背景）和他们的性格（或你们的关系）。"
        : "";

    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: memoryPrompt() + forceNote },
        {
            role: "user",
            content: withCurrentTime(
                `刚处理完一封来自 ${sender} 的邮件。` +
                    memoryCtx +
                    `\n\n你们最近的对话记录（最新的在最后）：\n${transcript}` +
                    `\n\n如果有值得长期记住的事，输出记忆内容；否则输出 __SKIP__。`,
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
