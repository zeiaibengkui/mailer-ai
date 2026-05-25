import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { chatWithHistory } from "./ai";
import { processAIReply } from "./replyHandler";

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

            await processAIReply(task.sender, text);
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

