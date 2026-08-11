import { listSenders } from "../ai.ts";
import { loadTasks } from "../scheduler.ts";
import { app } from "./app.ts";
import { sendersDetailed } from "./senders.ts";

const STARTED_AT = Date.now();

// Overview endpoints: uptime + per-character summaries, and the character detail page.
app.get("/status", (c) =>
    c.json({
        uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
        characters: c.get("chars").map((ch) => ({
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
        c.get("chars").map((ch) => ({
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
    const ch = c.get("findChar")(c.req.param("name"));
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
