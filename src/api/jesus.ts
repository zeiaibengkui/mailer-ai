import { runJesus } from "../jesus.ts";
import { app } from "./app.ts";

// The Jesus supervisor: give it a plain-language command and it drives the characters
// through native tool calls (read/tamper history, edit memory, ask/command agents, summarize).
app.post("/jesus", async (c) => {
    const body = await c.req.json().catch(() => null);
    const command = typeof body?.command === "string" ? body.command.trim() : "";
    if (!command) return c.json({ error: "body requires a non-empty `command` string" }, 400);
    try {
        const result = await runJesus(c.get("chars"), command);
        return c.json({ ok: true, ...result });
    } catch (e) {
        console.error("[jesus] failed:", e);
        return c.json({ error: "jesus failed" }, 500);
    }
});
