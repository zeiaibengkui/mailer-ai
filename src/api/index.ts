import { serve } from "@hono/node-server";
import type { Character } from "../character.ts";
import { app, configure } from "./app.ts";
import "./characters.ts"; // route registration side effects
import "./senders.ts";
import "./tasks.ts";
import "./messages.ts";
import "./memory.ts";
import "./banned.ts";

export function startApi(chars: Character[]) {
    configure(chars);
    const port = Number(process.env.API_PORT) || 3000;
    serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
        console.log(`API listening on http://${info.address}:${info.port} (localhost only)`);
    });
}
