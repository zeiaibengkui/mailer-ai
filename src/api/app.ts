import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Character } from "../character.ts";

/** Per-request API context: the loaded characters plus a name→character lookup. */
export type ApiVars = {
    chars: Character[];
    findChar: (name: string) => Character | undefined;
};

// Auth is mandatory. Require a stable key from .env rather than generating one:
// a generated key would have to be printed to the log (a secret in logs) and
// would rotate on every restart.
const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("[api] API_KEY is not set — add it to .env (e.g. `openssl rand -hex 24`) and restart.");
    process.exit(1);
}

/**
 * The shared Hono app. Resource modules under api/ register routes on it at
 * import time, and every handler reads the character context through Hono
 * request Variables (`c.get("findChar")` / `c.get("chars")`) — never a global.
 */
export const app = new Hono<{ Variables: ApiVars }>();

// Set once by startApi() before the server starts; read per-request by the
// middleware below, so handlers never touch this module directly.
let chars: Character[] = [];
export function configure(chars_: Character[]) {
    chars = chars_;
}

// CORS for the browser dashboard. `*` is safe here because every real request
// still needs the Bearer key below, the API only binds to 127.0.0.1, and we
// never use cookies. Preflight (OPTIONS) is answered before the auth check so
// the browser can send the Authorization header on the actual request.
app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization"] }));

// Registered at module scope — before any route handler — so every request hits
// the auth gate and gets its per-request Variables seeded.
app.use("*", async (c, next) => {
    const auth = c.req.header("Authorization");
    if (auth !== `Bearer ${apiKey}`) return c.json({ error: "unauthorized" }, 401);
    c.set("chars", chars);
    c.set("findChar", (name) => chars.find((ch) => ch.name === name));
    await next();
});

app.get("/health", (c) => c.json({ ok: true }));
