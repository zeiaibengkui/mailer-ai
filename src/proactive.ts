import { readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { sendEmail } from "./mail.ts";
import { proactiveChat, extractReply } from "./ai.ts";

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

        const r = extractReply(text);
        if (!r) continue;

        await sendEmail(sender, r.subject, r.body);
        tracker[sender] = new Date().toISOString();
        saveTracker(tracker);
        console.log(`[Proactive] Chatted with ${sender}: ${r.subject}`);
    }
}

export function startProactive() {
    setInterval(processProactive, INTERVAL_MS);
}
