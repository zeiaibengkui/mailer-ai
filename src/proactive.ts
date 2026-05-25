import { readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { processAIReply } from "./replyHandler.ts";
import type { ChatCompletionMessageParam } from "openai/resources";
import { loadHistory, prompt, client, saveHistory } from "./ai.ts";

const TRACK_FILE = "data/proactive_tracker.json";
const INTERVAL_MS = Number(process.env.PROACTIVE_INTERVAL_MS) || 300000;
const MIN_GAP_MS = 3600000; // at least 1h between proactive messages per sender

function loadTracker(): Record<string, string> {
    if (!existsSync(TRACK_FILE)) return {};
    return JSON.parse(readFileSync(TRACK_FILE, "utf-8"));
}

function saveTracker(t: Record<string, string>) {
    writeFileSync(TRACK_FILE, JSON.stringify(t, null, 2));
}

export async function processProactive() {
    const dir = "data/senders";
    if (!existsSync(dir)) return;

    const tracker = loadTracker();
    const files = readdirSync(dir);

    for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const sender = Buffer.from(file.slice(0, -5), "base64").toString("utf-8");

        const lastTime = tracker[sender] ? new Date(tracker[sender]).getTime() : 0;
        if (Date.now() - lastTime < MIN_GAP_MS) continue;

        const text = await proactiveChat(sender);
        if (!text) continue;

        const result = await processAIReply(sender, text);
        if (result === "sent") {
            tracker[sender] = new Date().toISOString();
            saveTracker(tracker);
        }
    }
}

export function startProactive() {
    setInterval(processProactive, INTERVAL_MS);
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
        {
            role: "user",
            content: "（随机唤醒，可以主动找主人聊天,或者太晚了就__SKIP__或者__LATER__吧。" +
                "如果主人留了定时任务但你没设__LATER__，可以现在设置）",
        },
    ];

    const reply = await client.chat.completions.create({
        model: "deepseek-v4-flash",
        messages,
    });

    const text = reply.choices[0]?.message?.content;
    if (!text || text.includes("__SKIP__")) return null;

    history.push({ role: "assistant", content: text });
    saveHistory(sender, history);

    return text;
}

