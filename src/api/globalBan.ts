import { decodeSenderId } from "../ai.ts";
import { addPattern, loadPatterns, removePattern } from "../globalBan.ts";
import { app } from "./app.ts";

// Bot-wide ban patterns (regexps on the sender email), applied to every character.
app.get("/banned-patterns", (c) => c.json({ patterns: loadPatterns() }));

app.post("/banned-patterns", async (c) => {
    const body = await c.req.json().catch(() => null);
    const pattern = typeof body?.pattern === "string" ? body.pattern.trim() : "";
    if (!pattern) return c.json({ error: "body requires a non-empty `pattern` string" }, 400);
    try {
        addPattern(pattern);
    } catch {
        return c.json({ error: `invalid regexp: ${pattern}` }, 400);
    }
    return c.json({ ok: true, pattern, patterns: loadPatterns() });
});

app.delete("/banned-patterns/:patternId", (c) => {
    removePattern(decodeSenderId(c.req.param("patternId")));
    return c.json({ ok: true, patterns: loadPatterns() });
});
