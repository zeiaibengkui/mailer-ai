import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import type { Character } from "./character.ts";
import { normalizeSender } from "./sender.ts";

/**
 * Per-character ban list: senders the character will permanently never reply to
 * (and never proactively message). Stored as an array of normalized bare emails
 * in `characters/<name>/banned.json`. Driven by the model's `__BAN__` protocol
 * token and manageable via the API/dashboard.
 */
function banFile(char: Character): string {
    return `${char.dir}/banned.json`;
}

function loadBanned(char: Character): string[] {
    const file = banFile(char);
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, "utf-8"));
}

function saveBanned(char: Character, banned: string[]) {
    mkdirSync(char.dir, { recursive: true });
    writeFileSync(banFile(char), JSON.stringify(banned, null, 2));
}

/** All banned senders for a character, sorted. */
export function listBanned(char: Character): string[] {
    return [...new Set(loadBanned(char))].sort();
}

/** True if the character should never reply to (or proactively message) this sender. */
export function isBanned(char: Character, sender: string): boolean {
    return loadBanned(char).includes(normalizeSender(sender));
}

/** Permanently stop replying to a sender. Idempotent; history is kept (unban is reversible). */
export function addBan(char: Character, sender: string): string {
    const normalized = normalizeSender(sender);
    if (!normalized) return normalized;
    if (!isBanned(char, normalized)) {
        saveBanned(char, [...loadBanned(char), normalized]);
    }
    return normalized;
}

/** Lift a ban. History is untouched. */
export function removeBan(char: Character, sender: string) {
    const normalized = normalizeSender(sender);
    saveBanned(
        char,
        loadBanned(char).filter((s) => s !== normalized),
    );
}
