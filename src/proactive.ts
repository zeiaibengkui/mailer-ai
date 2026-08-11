import { readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { processAIReply } from "./replyHandler.ts";
import type { ChatCompletionMessageParam } from "openai/resources";
import { loadHistory, client, saveHistory, withCurrentTime } from "./ai.ts";
import type { Character } from "./character.ts";

/** Shared proactive prompts (prompts/proactive.md): wake-up (system) + trigger (user), split by a `---` line. */
const PROACTIVE_PROMPT_PATH = "prompts/proactive.md";
const DEFAULT_PROACTIVE_SYS = "现在主动给主人发一条消息，关心一下主人或者找个话题聊天。";
const DEFAULT_PROACTIVE_USER =
    "（随机唤醒，可以主动找主人聊天,或者太晚了就__SKIP__或者__LATER__吧。" +
    "如果主人留了定时任务但你没设__LATER__，可以现在设置）";

/** Read prompts/proactive.md; falls back to built-in defaults if the file is missing. */
function proactivePrompts(): { sys: string; user: string } {
    if (!existsSync(PROACTIVE_PROMPT_PATH)) {
        return { sys: DEFAULT_PROACTIVE_SYS, user: DEFAULT_PROACTIVE_USER };
    }
    // Two sections split by a `---` line; `#` heading lines are human labels and are stripped.
    const [sys, user] = readFileSync(PROACTIVE_PROMPT_PATH, "utf-8").split(/\n---\n/);
    const clean = (s: string | undefined) =>
        (s ?? "").split("\n").filter((l) => !/^#\s/.test(l)).join("\n").trim();
    return {
        sys: clean(sys) || DEFAULT_PROACTIVE_SYS,
        user: clean(user) || DEFAULT_PROACTIVE_USER,
    };
}

function trackFile(char: Character): string {
    return `${char.dir}/proactive_tracker.json`;
}

function loadTracker(char: Character): Record<string, string> {
    const file = trackFile(char);
    if (!existsSync(file)) return {};
    return JSON.parse(readFileSync(file, "utf-8"));
}

function saveTracker(char: Character, t: Record<string, string>) {
    writeFileSync(trackFile(char), JSON.stringify(t, null, 2));
}

/** Forget a sender's last-proactive time (called when their history is deleted). */
export function clearTrackerEntry(char: Character, sender: string) {
    const tracker = loadTracker(char);
    if (!(sender in tracker)) return;
    delete tracker[sender];
    saveTracker(char, tracker);
}

export async function processProactive(char: Character) {
    const dir = `${char.dir}/senders`;
    if (!existsSync(dir)) return;

    const tracker = loadTracker(char);
    const files = readdirSync(dir);

    for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const sender = Buffer.from(file.slice(0, -5), "base64").toString("utf-8");

        const lastTime = tracker[sender] ? new Date(tracker[sender]).getTime() : 0;
        if (Date.now() - lastTime < char.conf.bot.proactive_min_gap_ms) continue;

        const text = await proactiveChat(char, sender);
        if (!text) continue;

        const result = await processAIReply(char, sender, text);
        if (result === "sent") {
            tracker[sender] = new Date().toISOString();
            saveTracker(char, tracker);
        }
    }
}

export function startProactive(char: Character) {
    setInterval(() => processProactive(char), char.conf.bot.proactive_interval_ms);
}

export async function proactiveChat(char: Character, sender: string): Promise<string | null> {
    const history = loadHistory(char, sender);
    const exchangeCount = Math.floor(history.length / 2);

    // Gradually decreasing probability
    const prob = Math.exp(-exchangeCount * 0.3);
    if (Math.random() > prob) return null;

    const { sys, user } = proactivePrompts();
    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: char.prompt + "\n\n" + sys },
        ...history,
        {
            role: "user",
            content: withCurrentTime(user),
        },
    ];

    const reply = await client.chat.completions.create({
        model: char.conf.bot.proactive_model,
        messages,
    });

    const text = reply.choices[0]?.message?.content;
    if (!text || text.includes("__SKIP__")) return null;

    history.push({ role: "assistant", content: text });
    saveHistory(char, sender, history);

    return text;
}
