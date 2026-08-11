import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { Character } from "./character.ts";
import {
    listSenders,
    encodeSenderId,
    decodeSenderId,
    loadHistory,
    saveHistory,
    ensureSender,
    deleteSender,
} from "./ai.ts";
import { loadTasks, removeTask } from "./scheduler.ts";
import { clearTrackerEntry, setMuted, senderProactiveStates, triggerProactive } from "./proactive.ts";
import { sendEmail } from "./mail.ts";
import { normalizeSender } from "./sender.ts";
import { appendMemory, loadMemoryEntries } from "./memory.ts";
import { addBan, isBanned, listBanned, removeBan } from "./ban.ts";

const STARTED_AT = Date.now();

export function startApi(chars: Character[]) {
    const app = new Hono();
    const port = Number(process.env.API_PORT) || 3000;

    // Auth is mandatory. Require a stable key from .env rather than generating one:
    // a generated key would have to be printed to the log (a secret in logs) and
    // would rotate on every restart.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("[api] API_KEY is not set — add it to .env (e.g. `openssl rand -hex 24`) and restart.");
        process.exit(1);
    }

    // CORS for the browser dashboard. `*` is safe here because every real request
    // still needs the Bearer key below, the API only binds to 127.0.0.1, and we
    // never use cookies. Preflight (OPTIONS) is answered before the auth check so
    // the browser can send the Authorization header on the actual request.
    app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization"] }));

    app.use("*", async (c, next) => {
        const auth = c.req.header("Authorization");
        if (auth !== `Bearer ${apiKey}`) return c.json({ error: "unauthorized" }, 401);
        await next();
    });

    const findChar = (name: string) => chars.find((c) => c.name === name);

    // Sender summaries enriched with per-sender proactive state (muted + last-proactive)
    // and ban state, so the dashboard can render mute toggles and ban chips.
    const sendersDetailed = (ch: Character) => {
        const states = senderProactiveStates(ch);
        return listSenders(ch).map((s) => ({
            ...s,
            muted: states[s.sender]?.muted ?? false,
            lastProactive: states[s.sender]?.lastProactive ?? null,
            banned: isBanned(ch, s.sender),
        }));
    };

    app.get("/health", (c) => c.json({ ok: true }));

    app.get("/status", (c) =>
        c.json({
            uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
            characters: chars.map((ch) => ({
                name: ch.name,
                email: ch.conf.smtp.user,
                model: ch.conf.bot.model,
                proactiveModel: ch.conf.bot.proactive_model,
                senders: listSenders(ch).length,
                tasks: loadTasks(ch).length,
            })),
        }),
    );

    app.get("/characters", (c) =>
        c.json(
            chars.map((ch) => ({
                name: ch.name,
                email: ch.conf.smtp.user,
                imapHost: ch.conf.imap.host,
                imapPort: ch.conf.imap.port,
                model: ch.conf.bot.model,
                proactiveModel: ch.conf.bot.proactive_model,
                senders: listSenders(ch),
            })),
        ),
    );

    app.get("/characters/:name", (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        return c.json({
            name: ch.name,
            email: ch.conf.smtp.user,
            imap: { host: ch.conf.imap.host, port: ch.conf.imap.port, secure: ch.conf.imap.secure, user: ch.conf.imap.user },
            smtp: { host: ch.conf.smtp.host, port: ch.conf.smtp.port, secure: ch.conf.smtp.secure, user: ch.conf.smtp.user },
            bot: ch.conf.bot,
            senders: sendersDetailed(ch),
            tasks: loadTasks(ch),
        });
    });

    app.get("/characters/:name/senders", (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        return c.json(sendersDetailed(ch));
    });

    app.post("/characters/:name/senders", async (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        const body = await c.req.json().catch(() => null);
        const sender = normalizeSender(typeof body?.sender === "string" ? body.sender : "");
        if (!sender) return c.json({ error: "body requires a non-empty `sender` string" }, 400);
        const created = ensureSender(ch, sender);
        return c.json({ id: encodeSenderId(sender), sender, created }, created ? 201 : 200);
    });

    app.get("/characters/:name/senders/:senderId", (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        const sender = decodeSenderId(c.req.param("senderId"));
        return c.json({ id: c.req.param("senderId"), sender, history: loadHistory(ch, sender) });
    });

    app.delete("/characters/:name/senders/:senderId", (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        const sender = decodeSenderId(c.req.param("senderId"));
        deleteSender(ch, sender);
        clearTrackerEntry(ch, sender);
        return c.json({ ok: true, sender });
    });

    // Mute/unmute proactive messages for a sender: `{ "muted": true|false }`.
    app.patch("/characters/:name/senders/:senderId/proactive", async (c) => {
        const ch = findChar(c.req.param("name"));
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
        const ch = findChar(c.req.param("name"));
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

    app.get("/characters/:name/tasks", (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        return c.json(loadTasks(ch));
    });

    app.delete("/characters/:name/tasks/:id", (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        removeTask(ch, c.req.param("id"));
        return c.json({ ok: true });
    });

    app.post("/characters/:name/messages", async (c) => {
        const ch = findChar(c.req.param("name"));
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

    // Long-term memory (per-character memory.md): view entries (newest first) or add one manually.
    app.get("/characters/:name/memory", (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        return c.json({ memory: loadMemoryEntries(ch).reverse() });
    });

    app.post("/characters/:name/memory", async (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        const body = await c.req.json().catch(() => null);
        const sender = normalizeSender(typeof body?.sender === "string" ? body.sender : "");
        const content = typeof body?.content === "string" ? body.content.trim() : "";
        if (!sender || !content) {
            return c.json({ error: "body requires non-empty `sender` and `content` strings" }, 400);
        }
        const entry = appendMemory(ch, sender, content);
        return c.json({ ok: true, at: entry.at, sender: entry.sender });
    });

    // Ban list: senders the character will permanently never reply to.
    app.get("/characters/:name/banned", (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        return c.json({ banned: listBanned(ch) });
    });

    app.post("/characters/:name/banned", async (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        const body = await c.req.json().catch(() => null);
        const sender = normalizeSender(typeof body?.sender === "string" ? body.sender : "");
        if (!sender) return c.json({ error: "body requires a non-empty `sender` string" }, 400);
        const added = addBan(ch, sender);
        return c.json({ ok: true, sender: added, banned: listBanned(ch) });
    });

    app.delete("/characters/:name/banned/:senderId", (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        const sender = decodeSenderId(c.req.param("senderId"));
        removeBan(ch, sender);
        return c.json({ ok: true, banned: listBanned(ch) });
    });

    serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
        console.log(`API listening on http://${info.address}:${info.port} (localhost only)`);
    });
}
