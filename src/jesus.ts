import { client, askAgent, listSenders, loadHistory, saveHistory } from "./ai.ts";
import { processAIReply } from "./replyHandler.ts";
import { appendMemory, clearMemory, loadMemoryEntries, removeMemoryEntry } from "./memory.ts";
import { listBanned } from "./ban.ts";
import { normalizeSender } from "./sender.ts";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Character } from "./character.ts";

/**
 * The "Jesus" supervisor — an omnipotent director over every Mailer AI character.
 * It uses *native* OpenAI-style tool calls (not the __SKIP__/__LATER__/__BAN__ text
 * protocol) to read and modify the bots' memories, conversations, and behavior, then
 * reports back in plain language.
 */
const MODEL = process.env.JESUS_MODEL || "deepseek-v4-flash";
const MAX_TOOL_ITERATIONS = 15;

const JESUS_SYSTEM = `你是“耶稣”——Mailer AI 三个角色（asaperson、beggar、tweakor）的全知监督者与导演。你能看见并修改它们的一切：长期记忆、对话历史、拉黑名单、定时任务。

用户给你的指令通常是：篡改某段对话、改某个角色的记忆、总结当前剧情、让某个角色做什么、调查三个人的关系等。

要求：
1. 先调用工具查明真实状态，再动手；绝不凭空捏造。
2. 需要改动时用工具：append_history 篡改对话、add_memory/delete_memory/clear_memory 改记忆、command_agent 让角色行动（会真的发邮件）、ask_agent 询问角色想法。只读需求用 get_overview / read_memory / read_history / list_senders。
3. 完成后用中文向用户报告：查到了什么、改了什么、当前剧情与人物关系长什么样。精简但有画面感。`;

type ToolFn = (args: Record<string, any>, chars: Character[]) => Promise<unknown> | unknown;

interface ToolDef {
    def: ChatCompletionTool;
    fn: ToolFn;
}

const tool = (
    name: string,
    description: string,
    properties: Record<string, any>,
    required: string[],
    fn: ToolFn,
): ToolDef => ({
    def: {
        type: "function",
        function: { name, description, parameters: { type: "object", properties, required } },
    },
    fn,
});

const findChar = (chars: Character[], name?: string) => chars.find((c) => c.name === name);

const str = (s: any) => (typeof s === "string" ? s.trim() : "");
const senderOf = (chars: Character[], name?: string, sender?: string) => {
    const ch = findChar(chars, name);
    return { ch, sender: normalizeSender(str(sender)) };
};

const tools: ToolDef[] = [
    tool(
        "list_characters",
        "List every character: name, email, sender count, memory count.",
        {},
        [],
        (_, chars) =>
            chars.map((c) => ({
                name: c.name,
                email: c.conf.smtp.user,
                senders: listSenders(c).length,
                memory: loadMemoryEntries(c).length,
            })),
    ),
    tool(
        "get_overview",
        "Full picture of every character: all senders (with exchanges), all memory entries, and the ban list. Use this to summarize the plot.",
        {},
        [],
        (_, chars) =>
            chars.map((c) => ({
                name: c.name,
                email: c.conf.smtp.user,
                senders: listSenders(c),
                memory: loadMemoryEntries(c),
                banned: listBanned(c),
            })),
    ),
    tool(
        "read_memory",
        "Read one character's long-term memory entries.",
        { char: { type: "string", description: "character name" } },
        ["char"],
        ({ char }, chars) => {
            const ch = findChar(chars, char);
            return ch ? loadMemoryEntries(ch) : { error: `unknown character ${char}` };
        },
    ),
    tool(
        "add_memory",
        "Add a long-term memory entry for a character, tagged with which person it's about.",
        {
            char: { type: "string" },
            sender: { type: "string", description: "email the memory is about" },
            text: { type: "string" },
        },
        ["char", "sender", "text"],
        ({ char, sender, text }, chars) => {
            const ch = findChar(chars, char);
            if (!ch) return { error: `unknown character ${char}` };
            return appendMemory(ch, normalizeSender(sender), str(text));
        },
    ),
    tool(
        "delete_memory",
        "Delete one memory entry by its `at` timestamp.",
        { char: { type: "string" }, at: { type: "string", description: "entry's at timestamp" } },
        ["char", "at"],
        ({ char, at }, chars) => {
            const ch = findChar(chars, char);
            if (!ch) return { error: `unknown character ${char}` };
            return { removed: removeMemoryEntry(ch, str(at)) };
        },
    ),
    tool(
        "clear_memory",
        "Clear a character's memory. Omit `char` to clear ALL characters.",
        { char: { type: "string" } },
        [],
        ({ char }, chars) => {
            if (char) {
                const ch = findChar(chars, char);
                if (!ch) return { error: `unknown character ${char}` };
                clearMemory(ch);
                return { cleared: char };
            }
            for (const c of chars) clearMemory(c);
            return { cleared: "all" };
        },
    ),
    tool(
        "list_senders",
        "List a character's senders (lines) with exchange counts.",
        { char: { type: "string" } },
        ["char"],
        ({ char }, chars) => {
            const ch = findChar(chars, char);
            return ch ? listSenders(ch) : { error: `unknown character ${char}` };
        },
    ),
    tool(
        "read_history",
        "Read the full conversation between a character and a sender.",
        { char: { type: "string" }, sender: { type: "string", description: "email" } },
        ["char", "sender"],
        ({ char, sender }, chars) => {
            const { ch, sender: s } = senderOf(chars, char, sender);
            return ch ? loadHistory(ch, s) : { error: `unknown character ${char}` };
        },
    ),
    tool(
        "append_history",
        "Tamper with a conversation: append a message. role is 'user' (they said), 'assistant' (character said), or 'system' (authoritative instructions the AI trusts).",
        {
            char: { type: "string" },
            sender: { type: "string" },
            role: { type: "string", enum: ["user", "assistant", "system"] },
            content: { type: "string" },
        },
        ["char", "sender", "role", "content"],
        ({ char, sender, role, content }, chars) => {
            const { ch, sender: s } = senderOf(chars, char, sender);
            if (!ch) return { error: `unknown character ${char}` };
            if (!["user", "assistant", "system"].includes(role))
                return { error: "role must be user/assistant/system" };
            const history = loadHistory(ch, s);
            history.push({ role, content: str(content) });
            saveHistory(ch, s, history);
            return { ok: true, historyLength: history.length };
        },
    ),
    tool(
        "clear_history",
        "Wipe a conversation between a character and a sender. Omit `sender` to clear all of that character's conversations (lines stay registered).",
        { char: { type: "string" }, sender: { type: "string" } },
        ["char"],
        ({ char, sender }, chars) => {
            const ch = findChar(chars, char);
            if (!ch) return { error: `unknown character ${char}` };
            if (sender) {
                saveHistory(ch, normalizeSender(sender), []);
                return { cleared: 1 };
            }
            let n = 0;
            for (const s of listSenders(ch)) {
                saveHistory(ch, s.sender, []);
                n++;
            }
            return { cleared: n };
        },
    ),
    tool(
        "ask_agent",
        "Ask one character a question (transient — nothing saved or sent). It answers in its persona using its memory.",
        { char: { type: "string" }, sender: { type: "string" }, content: { type: "string" } },
        ["char", "sender", "content"],
        async ({ char, sender, content }, chars) => {
            const ch = findChar(chars, char);
            if (!ch) return { error: `unknown character ${char}` };
            const reply = await askAgent(ch, normalizeSender(sender), str(content), false, ch.conf.bot.thinking_model);
            return { reply };
        },
    ),
    tool(
        "command_agent",
        "Command one character to act (full reply pipeline: history saved, __BAN__/__LATER__ take effect, a normal reply is sent as a REAL email to the sender).",
        { char: { type: "string" }, sender: { type: "string" }, command: { type: "string" } },
        ["char", "sender", "command"],
        async ({ char, sender, command }, chars) => {
            const ch = findChar(chars, char);
            if (!ch) return { error: `unknown character ${char}` };
            const s = normalizeSender(sender);
            const text = await askAgent(ch, s, str(command), true, ch.conf.bot.thinking_model);
            const status = await processAIReply(ch, s, text);
            return { status, reply: text };
        },
    ),
];

export interface JesusResult {
    reply: string;
    steps: { name: string; args: string }[];
}

/**
 * Run the Jesus supervisor on a user command. The model calls tools (native function
 * calling) until it produces a final answer, then we return that answer plus a log of
 * the tool calls it made.
 */
export async function runJesus(chars: Character[], command: string): Promise<JesusResult> {
    const messages: any[] = [
        { role: "system", content: JESUS_SYSTEM },
        { role: "user", content: command },
    ];
    const steps: { name: string; args: string }[] = [];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const resp = await client.chat.completions.create({
            model: MODEL,
            messages,
            tools: tools.map((t) => t.def),
        });
        const msg: any = resp.choices[0]?.message;
        if (!msg) return { reply: "no response", steps };

        if (msg.tool_calls && msg.tool_calls.length > 0) {
            messages.push(msg);
            for (const tc of msg.tool_calls) {
                let args: Record<string, any> = {};
                try {
                    args = JSON.parse(tc.function.arguments || "{}");
                } catch {
                    args = {};
                }
                steps.push({ name: tc.function.name, args: JSON.stringify(args) });
                let result: unknown;
                try {
                    const t = tools.find((x) => (x.def as any).function.name === tc.function.name);
                    result = t ? await t.fn(args, chars) : { error: `unknown tool ${tc.function.name}` };
                } catch (e) {
                    result = { error: e instanceof Error ? e.message : String(e) };
                }
                messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
            }
            continue;
        }
        return { reply: msg.content ?? "", steps };
    }
    return { reply: "reached max tool iterations", steps };
}
