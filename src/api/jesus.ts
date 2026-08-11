import { runJesus, runJesusStream } from "../jesus.ts";
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

// Streaming variant: Server-Sent Events for thinking tokens, reply tokens, and tool calls.
app.post("/jesus/stream", async (c) => {
    const body = await c.req.json().catch(() => null);
    const command = typeof body?.command === "string" ? body.command.trim() : "";
    if (!command) return c.json({ error: "body requires a non-empty `command` string" }, 400);

    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: unknown) => {
                try {
                    controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
                } catch {
                    /* client closed */
                }
            };
            try {
                for await (const chunk of runJesusStream(c.get("chars"), command)) {
                    if (chunk.type === "thinking") send("thinking", { text: chunk.text });
                    else if (chunk.type === "delta") send("delta", { text: chunk.text });
                    else send("tool", { name: chunk.name, args: chunk.args });
                }
                send("done", {});
            } catch (e) {
                send("error", { message: e instanceof Error ? e.message : String(e) });
            } finally {
                try {
                    controller.close();
                } catch {
                    /* already closed */
                }
            }
        },
    });
    return c.body(stream);
});
