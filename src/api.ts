import { Hono } from "hono";
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
import { clearTrackerEntry } from "./proactive.ts";
import { sendEmail } from "./mail.ts";

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

    app.use("*", async (c, next) => {
        const auth = c.req.header("Authorization");
        if (auth !== `Bearer ${apiKey}`) return c.json({ error: "unauthorized" }, 401);
        await next();
    });

    const findChar = (name: string) => chars.find((c) => c.name === name);

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
            senders: listSenders(ch),
            tasks: loadTasks(ch),
        });
    });

    app.get("/characters/:name/senders", (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        return c.json(listSenders(ch));
    });

    app.post("/characters/:name/senders", async (c) => {
        const ch = findChar(c.req.param("name"));
        if (!ch) return c.json({ error: "unknown character" }, 404);
        const body = await c.req.json().catch(() => null);
        const sender = typeof body?.sender === "string" ? body.sender.trim() : "";
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
        const to = typeof body?.to === "string" ? body.to.trim() : "";
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

    serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
        console.log(`API listening on http://${info.address}:${info.port} (localhost only)`);
    });
}
