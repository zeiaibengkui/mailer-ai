import { addBan, listBanned, removeBan } from "../ban.ts";
import { decodeSenderId } from "../ai.ts";
import { normalizeSender } from "../sender.ts";
import { app } from "./app.ts";

// Ban list: senders the character will permanently never reply to.
app.get("/characters/:name/banned", (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    return c.json({ banned: listBanned(ch) });
});

app.post("/characters/:name/banned", async (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const body = await c.req.json().catch(() => null);
    const sender = normalizeSender(typeof body?.sender === "string" ? body.sender : "");
    if (!sender) return c.json({ error: "body requires a non-empty `sender` string" }, 400);
    const added = addBan(ch, sender);
    return c.json({ ok: true, sender: added, banned: listBanned(ch) });
});

app.delete("/characters/:name/banned/:senderId", (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    const sender = decodeSenderId(c.req.param("senderId"));
    removeBan(ch, sender);
    return c.json({ ok: true, banned: listBanned(ch) });
});
