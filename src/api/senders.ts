import { listSenders, ensureSender, deleteSender, loadHistory, encodeSenderId, decodeSenderId } from "../ai.ts";
import { clearTrackerEntry, senderProactiveStates, setMuted, triggerProactive } from "../proactive.ts";
import { isBanned } from "../ban.ts";
import { normalizeSender } from "../sender.ts";
import type { Character } from "../character.ts";
import { app } from "./app.ts";

/**
 * Sender summaries enriched with proactive state (muted + last-proactive) and ban
 * state, so the dashboard can render mute toggles and ban chips. Also used by the
 * character detail endpoint.
 */
export function sendersDetailed(ch: Character) {
    const states = senderProactiveStates(ch);
    return listSenders(ch).map((s) => ({
        ...s,
        muted: states[s.sender]?.muted ?? false,
        lastProactive: states[s.sender]?.lastProactive ?? null,
        banned: isBanned(ch, s.sender),
    }));
}

app.get("/characters/:name/senders", (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    return c.json(sendersDetailed(ch));
});

app.post("/characters/:name/senders", async (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const body = await c.req.json().catch(() => null);
    const sender = normalizeSender(typeof body?.sender === "string" ? body.sender : "");
    if (!sender) return c.json({ error: "body requires a non-empty `sender` string" }, 400);
    const created = ensureSender(ch, sender);
    return c.json({ id: encodeSenderId(sender), sender, created }, created ? 201 : 200);
});

app.get("/characters/:name/senders/:senderId", (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const sender = decodeSenderId(c.req.param("senderId"));
    return c.json({ id: c.req.param("senderId"), sender, history: loadHistory(ch, sender) });
});

app.delete("/characters/:name/senders/:senderId", (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const sender = decodeSenderId(c.req.param("senderId"));
    deleteSender(ch, sender);
    clearTrackerEntry(ch, sender);
    return c.json({ ok: true, sender });
});

// Mute/unmute proactive messages for a sender: `{ "muted": true|false }`.
app.patch("/characters/:name/senders/:senderId/proactive", async (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const body = await c.req.json().catch(() => null);
    if (typeof body?.muted !== "boolean") {
        return c.json({ error: "body requires a boolean `muted`" }, 400);
    }
    const sender = decodeSenderId(c.req.param("senderId"));
    setMuted(ch, sender, body.muted);
    return c.json({ ok: true, sender, muted: body.muted });
});

// Manually trigger one proactive message to a sender now (bypasses probability + min-gap).
app.post("/characters/:name/senders/:senderId/proactive", async (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const sender = decodeSenderId(c.req.param("senderId"));
    try {
        const status = await triggerProactive(ch, sender);
        return c.json({ ok: true, sender, status });
    } catch (e) {
        console.error(`[${ch.name}] [api] proactive trigger failed:`, e);
        return c.json({ error: "proactive trigger failed" }, 500);
    }
});
