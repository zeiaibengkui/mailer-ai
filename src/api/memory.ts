import { appendMemory, loadMemoryEntries } from "../memory.ts";
import { normalizeSender } from "../sender.ts";
import { app } from "./app.ts";

// Long-term memory (per-character memory.md): view entries (newest first) or add one manually.
app.get("/characters/:name/memory", (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    return c.json({ memory: loadMemoryEntries(ch).reverse() });
});

app.post("/characters/:name/memory", async (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
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
