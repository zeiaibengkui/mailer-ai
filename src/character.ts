import { parse } from "smol-toml";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join } from "path";

export interface SmtpConf {
    host: string;
    port: number;
    /** true = implicit TLS (465); false = STARTTLS (587) */
    secure: boolean;
    user: string;
    pass: string;
}

export interface ImapConf {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
}

export interface BotConf {
    fetch_interval_ms: number;
    proactive_interval_ms: number;
    proactive_min_gap_ms: number;
    model: string;
    proactive_model: string;
    /** Reasoning model ("thinking mode") used by the agent console's ask/command. */
    thinking_model: string;
}

export interface CharacterConf {
    smtp: SmtpConf;
    imap: ImapConf;
    bot: BotConf;
}

export interface Character {
    name: string;
    /** characters/<name>, relative to repo root */
    dir: string;
    conf: CharacterConf;
    /** contents of characters/<name>/prompt.md */
    prompt: string;
}

const CHARACTERS_DIR = "characters";
/** Optional shared prompt (prompts/base.md), appended to every character's own prompt.md. */
const SHARED_PROMPT_PATH = "prompts/base.md";

function normalizeConf(raw: Record<string, any>): CharacterConf {
    return {
        smtp: {
            host: raw.smtp?.host ?? "",
            port: raw.smtp?.port ?? 465,
            secure: raw.smtp?.secure ?? true,
            user: raw.smtp?.user ?? "",
            pass: raw.smtp?.pass ?? "",
        },
        imap: {
            host: raw.imap?.host ?? "",
            port: raw.imap?.port ?? 993,
            secure: raw.imap?.secure ?? true,
            user: raw.imap?.user ?? "",
            pass: raw.imap?.pass ?? "",
        },
        bot: {
            fetch_interval_ms: raw.bot?.fetch_interval_ms ?? 30000,
            proactive_interval_ms: raw.bot?.proactive_interval_ms ?? 300000,
            proactive_min_gap_ms: raw.bot?.proactive_min_gap_ms ?? 3600000,
            model: raw.bot?.model ?? "deepseek-chat",
            proactive_model: raw.bot?.proactive_model ?? "deepseek-v4-flash",
            thinking_model: raw.bot?.thinking_model ?? "deepseek-reasoner",
        },
    };
}

/** Load a single character by name, or null if its directory is incomplete. */
export function loadCharacter(name: string): Character | null {
    const dir = join(CHARACTERS_DIR, name);
    const confPath = join(dir, "conf.toml");
    const promptPath = join(dir, "prompt.md");
    if (!existsSync(confPath) || !existsSync(promptPath)) {
        console.warn(`[character] ${name}: missing conf.toml or prompt.md, skipping`);
        return null;
    }
    const conf = normalizeConf(parse(readFileSync(confPath, "utf-8")) as Record<string, any>);
    // Compose the shared prompt (all characters) with this character's persona.
    // The shared reply protocol is appended last so it sits closest to the model's output.
    const prompt = existsSync(SHARED_PROMPT_PATH)
        ? readFileSync(promptPath, "utf-8") + "\n\n" + readFileSync(SHARED_PROMPT_PATH, "utf-8")
        : readFileSync(promptPath, "utf-8");
    return { name, dir, conf, prompt };
}

/** Load every character directory (each with conf.toml + prompt.md). */
export function loadCharacters(): Character[] {
    if (!existsSync(CHARACTERS_DIR)) return [];
    const chars: Character[] = [];
    for (const entry of readdirSync(CHARACTERS_DIR)) {
        if (!statSync(join(CHARACTERS_DIR, entry)).isDirectory()) continue; // skip files like .lock
        const char = loadCharacter(entry);
        if (char) chars.push(char);
    }
    return chars;
}
