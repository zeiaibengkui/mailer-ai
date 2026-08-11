import { readFileSync, writeFileSync, existsSync } from "fs";
import { normalizeSender } from "./sender.ts";

/**
 * Global ban patterns: bot-wide regexps applied to every character's senders.
 * Any sender whose (normalized) address matches one of these patterns is treated
 * as banned everywhere — no replies, no proactive messages, no scheduled replies.
 * Stored at the repo root in `global_banned.json` (gitignored).
 */
const FILE = "global_banned.json";

export function loadPatterns(): string[] {
    if (!existsSync(FILE)) return [];
    const raw = JSON.parse(readFileSync(FILE, "utf-8"));
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
}

function savePatterns(patterns: string[]) {
    writeFileSync(FILE, JSON.stringify([...new Set(patterns)].sort(), null, 2));
}

/** True if the sender matches any global ban pattern (regexp, case-insensitive). */
export function isGloballyBanned(sender: string): boolean {
    const s = normalizeSender(sender);
    for (const p of loadPatterns()) {
        try {
            if (new RegExp(p, "i").test(s)) return true;
        } catch {
            // A stored pattern that no longer compiles is skipped, not fatal.
        }
    }
    return false;
}

/** Add a ban pattern. Throws a SyntaxError if the regexp is invalid. */
export function addPattern(pattern: string): string {
    const p = pattern.trim();
    new RegExp(p); // validate before persisting
    savePatterns([...loadPatterns(), p]);
    return p;
}

export function removePattern(pattern: string) {
    savePatterns(loadPatterns().filter((p) => p !== pattern));
}
