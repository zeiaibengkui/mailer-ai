import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { chatWithHistory } from "./ai.ts";
import { processAIReply } from "./replyHandler.ts";
import type { Character } from "./character.ts";

function crontabFile(char: Character): string {
    return `${char.dir}/crontab.json`;
}

export type ScheduledTask = {
    id: string;
    sender: string;
    scheduledAt: string; // ISO
};

export function loadTasks(char: Character): ScheduledTask[] {
    const file = crontabFile(char);
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, "utf-8"));
}

export function saveTasks(char: Character, tasks: ScheduledTask[]) {
    mkdirSync(char.dir, { recursive: true });
    writeFileSync(crontabFile(char), JSON.stringify(tasks, null, 2));
}

export function addTask(char: Character, task: ScheduledTask) {
    const tasks = loadTasks(char);
    tasks.push(task);
    saveTasks(char, tasks);
}

export function removeTask(char: Character, id: string) {
    const tasks = loadTasks(char).filter((t) => t.id !== id);
    saveTasks(char, tasks);
}

export function getDueTasks(char: Character): ScheduledTask[] {
    const now = Date.now();
    return loadTasks(char).filter((t) => new Date(t.scheduledAt).getTime() <= now);
}

export function parseLaterTime(input: string): Date | null {
    const iso = Date.parse(input.trim());
    return isNaN(iso) ? null : new Date(iso);
}

export function handleLater(text: string): Date | null {
    const m = text.match(/__LATER__\(([^)]+)\)/);
    if (!m) return null;
    return parseLaterTime(m[1]);
}

export async function processCrontab(char: Character) {
    const due = getDueTasks(char);
    for (const task of due) {
        try {
            removeTask(char, task.id);
            const text = await chatWithHistory(
                char,
                task.sender,
                "你之前说过要在这个时间点回复的。现在时间到了，要不要回复？" +
                "如果不回复，输出__SKIP__。如果要回复，按正常格式输出主题和正文。" +
                "另外现在这个时间也可以写到正文里。"
            );

            await processAIReply(char, task.sender, text);
        } catch (e) {
            console.error(`[${char.name}] [Crontab] Failed for ${task.sender}:`, e);
        }
    }
}

export const CRONTAB_CHECK_MS = 60000;
