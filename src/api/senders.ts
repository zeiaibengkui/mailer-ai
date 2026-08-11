import { listSenders, ensureSender, deleteSender, loadHistory, saveHistory, encodeSenderId, decodeSenderId } from "../ai.ts";
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

// Tamper with a conversation: append a message to steer the agent's context. `system` messages
// are treated as authoritative instructions (the AI trusts them); `user` = "they said",
// `assistant` = "the character said". The next chat/reply will see it.
app.post("/characters/:name/senders/:senderId/history", async (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const body = await c.req.json().catch(() => null);
    const role = body?.role;
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (role !== "user" && role !== "assistant" && role !== "system") {
        return c.json({ error: "`role` must be 'user', 'assistant', or 'system'" }, 400);
    }
    if (!content) return c.json({ error: "body requires a non-empty `content` string" }, 400);
    const rawId = c.req.param("senderId");
    const sender = decodeSenderId(rawId);
    // Defense-in-depth: the on-disk filename is base64-derived (so `..`/`/` can't escape),
    // but reject non-canonical ids anyway so only well-formed senders are touched.
    if (encodeSenderId(sender) !== rawId) {
        return c.json({ error: "invalid sender id" }, 400);
    }
    const history = loadHistory(ch, sender);
    history.push({ role, content });
    saveHistory(ch, sender, history);
    return c.json({ ok: true, sender, historyLength: history.length });
});

// Wipe every conversation for this character, keeping all senders (lines) registered.
app.delete("/characters/:name/history", (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    let cleared = 0;
    for (const s of listSenders(ch)) {
        saveHistory(ch, s.sender, []);
        cleared++;
    }
    return c.json({ ok: true, cleared });
});

// Clear a conversation (keep the sender registered).
app.delete("/characters/:name/senders/:senderId/history", (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const rawId = c.req.param("senderId");
    const sender = decodeSenderId(rawId);
    if (encodeSenderId(sender) !== rawId) {
        return c.json({ error: "invalid sender id" }, 400);
    }
    saveHistory(ch, sender, []);
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
