import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
const LOCK_FILE = "data/app.lock";

if (existsSync(LOCK_FILE)) {
    const pid = readFileSync(LOCK_FILE, "utf-8").trim();
    // process.kill(Number(pid), 0);
    console.error(`Another instance is running (PID ${pid}). Exiting.`);
    process.exit(1);
} else {
    writeFileSync(LOCK_FILE, String(process.pid));
    process.on("exit", releaseLock);
    process.on("SIGINT", () => { releaseLock(); process.exit(); });
    process.on("SIGTERM", () => { releaseLock(); process.exit(); });
}

function releaseLock() {
    try { unlinkSync(LOCK_FILE); } catch { }
}


