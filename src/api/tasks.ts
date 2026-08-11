import { loadTasks, removeTask } from "../scheduler.ts";
import { app } from "./app.ts";

app.get("/characters/:name/tasks", (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    return c.json(loadTasks(ch));
});

app.delete("/characters/:name/tasks/:id", (c) => {
    const ch = c.get("findChar")(c.req.param("name"));
    if (!ch) return c.json({ error: "unknown character" }, 404);
    removeTask(ch, c.req.param("id"));
    return c.json({ ok: true });
});
