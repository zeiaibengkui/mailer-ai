import { askAgent, listSenders } from "../ai.ts";
import { processAIReply } from "../replyHandler.ts";
import { normalizeSender } from "../sender.ts";
import { app } from "./app.ts";

// Agent console: ask a question (transient) or issue a command (full reply pipeline).

// Ask: the agent answers using its persona + memory + this sender's history, but nothing
// is saved and no email is sent — a pure probe.
app.post("/characters/:name/ask", async (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const body = await c.req.json().catch(() => null);
    const sender = normalizeSender(typeof body?.sender === "string" ? body.sender : "");
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!sender || !content) {
        return c.json({ error: "body requires non-empty `sender` and `content` strings" }, 400);
    }
    // Same known-sender rule as /command: the ask loads that sender's history as context,
    // so keep it to senders this character already knows (register via POST /senders first).
    if (!listSenders(ch).some((s) => s.sender === sender)) {
        return c.json({ error: "unknown sender for this character — add it first" }, 403);
    }
    try {
        const reply = await askAgent(ch, sender, content, false, ch.conf.bot.thinking_model);
        return c.json({ ok: true, sender, reply });
    } catch (e) {
        console.error(`[${ch.name}] [api] ask failed:`, e);
        return c.json({ error: "ask failed" }, 500);
    }
});

// Command: routed through the exact same pipeline as an incoming email — the exchange is
// saved to history, `__BAN__`/`__LATER__`/`__SKIP__` take effect, and a normal reply is
// sent as a real email to the sender.
app.post("/characters/:name/command", async (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const body = await c.req.json().catch(() => null);
    const sender = normalizeSender(typeof body?.sender === "string" ? body.sender : "");
    const command = typeof body?.command === "string" ? body.command.trim() : "";
    if (!sender || !command) {
        return c.json({ error: "body requires non-empty `sender` and `command` strings" }, 400);
    }
    // A command can send a real email / ban / schedule, so only allow commanding senders
    // this character already knows (register via POST /senders first).
    if (!listSenders(ch).some((s) => s.sender === sender)) {
        return c.json({ error: "unknown sender for this character — add it first" }, 403);
    }
    try {
        // Same save-to-history semantics as chatWithHistory, but on the thinking model so the
        // agent reasons properly about the command instead of breezing past it.
        const text = await askAgent(ch, sender, command, true, ch.conf.bot.thinking_model);
        const status = await processAIReply(ch, sender, text);
        return c.json({ ok: true, sender, status, reply: text });
    } catch (e) {
        console.error(`[${ch.name}] [api] command failed:`, e);
        return c.json({ error: "command failed" }, 500);
    }
});
