import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

const CRONTAB_FILE = "data/crontab.json";

export type ScheduledTask = {
    id: string;
    sender: string;
    subject: string;
    body: string;
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
