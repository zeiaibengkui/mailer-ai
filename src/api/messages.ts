import { loadHistory, saveHistory } from "../ai.ts";
import { sendEmail } from "../mail.ts";
import { normalizeSender } from "../sender.ts";
import { app } from "./app.ts";

app.post("/characters/:name/messages", async (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const body = await c.req.json().catch(() => null);
    const to = normalizeSender(typeof body?.to === "string" ? body.to : "");
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!to || !subject || !text) {
        return c.json({ error: "body requires `to`, `subject` and `body` strings" }, 400);
    }
    try {
        await sendEmail(ch, to, subject, text);
    } catch (e) {
        console.error(`[${ch.name}] [api] send failed:`, e);
        return c.json({ error: "send failed" }, 500);
    }
    // Record the outgoing message so the AI remembers it sent it.
    const history = loadHistory(ch, to);
    history.push({ role: "assistant", content: `[manual] ${subject}\n\n${text}` });
    saveHistory(ch, to, history);
    return c.json({ ok: true, to, subject });
});
