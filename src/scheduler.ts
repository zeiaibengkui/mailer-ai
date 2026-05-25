import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "node:crypto";
import { chatWithHistory, proactiveChat } from "./ai";
import { sendEmail } from "./mail";
import { extractReply } from "./ai";

const CRONTAB_FILE = "data/crontab.json";

export type ScheduledTask = {
    id: string;
    sender: string;
    scheduledAt: string; // ISO
};

export function loadTasks(): ScheduledTask[] {
    if (!existsSync(CRONTAB_FILE)) return [];
    return JSON.parse(readFileSync(CRONTAB_FILE, "utf-8"));
}

export function saveTasks(tasks: ScheduledTask[]) {
    mkdirSync("data", { recursive: true });
    writeFileSync(CRONTAB_FILE, JSON.stringify(tasks, null, 2));
}

export function addTask(task: ScheduledTask) {
    const tasks = loadTasks();
    tasks.push(task);
    saveTasks(tasks);
}

export function removeTask(id: string) {
    const tasks = loadTasks().filter((t) => t.id !== id);
    saveTasks(tasks);
}

export function getDueTasks(): ScheduledTask[] {
    const now = Date.now();
    return loadTasks().filter((t) => new Date(t.scheduledAt).getTime() <= now);
}

export function parseLaterTime(input: string): Date | null {
    const iso = Date.parse(input.trim());
    return isNaN(iso) ? null : new Date(iso);
}
export async function processCrontab() {
    const due = getDueTasks();
    for (const task of due) {
        try {
            removeTask(task.id);
            const text = await chatWithHistory(
                task.sender,
                "你之前说过要在这个时间点回复的。现在时间到了，要不要回复？" +
                "如果不回复，输出__SKIP__。如果要回复，按正常格式输出主题和正文。" +
                "另外现在这个时间也可以写到正文里。"
            );

            if (text.includes("__SKIP__")) {
                console.log(`[Crontab] Decided to skip reply to ${task.sender}`);
                continue;
            }

            // Also handle __LATER__ from this decision (re-schedule)
            if (text.includes("__LATER__")) {
                const laterTime = handleLater(text);
                if (laterTime) {
                    addTask({
                        id: randomUUID(),
                        sender: task.sender,
                        scheduledAt: laterTime.toISOString(),
                    });
                    console.log(
                        `[Crontab] Re-scheduled for ${task.sender} at ${laterTime.toISOString()}`
                    );
                }
                continue;
            }

            const r = extractReply(text);
            if (!r) {
                console.log(`[Crontab] Could not parse reply for ${task.sender}, skipping`);
                continue;
            }

            await sendEmail(task.sender, r.subject, r.body);
            console.log(`[Crontab] Sent timed reply to ${task.sender}: ${r.subject}`);

            const pro = await proactiveChat(task.sender);
            if (pro) {
                const pr = extractReply(pro);
                if (pr) {
                    await sendEmail(task.sender, pr.subject, pr.body);
                    console.log(`[Proactive] Chatted with ${task.sender}: ${pr.subject}`);
                }
            }
        } catch (e) {
            console.error(`[Crontab] Failed for ${task.sender}:`, e);
        }
    }
} export function handleLater(text: string): Date | null {
    const m = text.match(/__LATER__\(([^)]+)\)/);
    if (!m) return null;
    return parseLaterTime(m[1]);
}
export const CRONTAB_CHECK_MS = 60000;

