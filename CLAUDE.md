# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mailer AI is an always-on email auto-reply bot that runs **multiple independent characters**. Each `characters/<name>/` directory is one personality with its own prompt, its own IMAP/SMTP credentials (in `conf.toml`), and its own state (sender histories, seen UIDs, scheduled tasks, proactive tracker). Per character, it polls the IMAP inbox, feeds each new email plus the sender's conversation history to a DeepSeek chat model, and acts on the model's structured reply (skip / schedule for later / send a reply). It can also proactively start conversations with senders it has history with. The DeepSeek API key is shared globally via `.env`.

## Commands

- **Run**: `pnpm start` — runs `tsx watch src/main.mts`, so it auto-restarts on file changes. Loads every character under `characters/`.
- **Register a contact**: `pnpm add-sender <character> <email> [more...]` — creates an empty history file for that sender under the character's `senders/` dir so the proactive loop will message them.
- **Install**: `pnpm install`
- **Typecheck**: `npx tsc --noEmit` (tsconfig has `noEmit: true`; there is no build step).
- **Control API**: `src/api.ts` starts a Hono server on `127.0.0.1:API_PORT` (default 3000) with optional `Bearer` auth via `API_KEY`. See README "REST Control API" for the endpoint table. Sender `id`s in API URLs are URL-safe base64 (via `encodeSenderId`/`decodeSenderId` in `ai.ts`), while on-disk filenames use standard base64.
- **Tests**: none. `pnpm test` just prints an error. Verify changes by running the bot and watching logs.

## Architecture

Entry point `src/main.mts` loads all characters, starts the REST API (`startApi(chars)`), then per character wires three independent loops:

1. `setInterval(processCrontab, CRONTAB_CHECK_MS)` — fires due scheduled tasks.
2. `startProactive()` — every `conf.bot.proactive_interval_ms` (default 300000), may message senders with existing history.
3. `runReceiveLoop(char)`: `onReceive(char)` (blocks until an unseen email arrives, polling every `conf.bot.fetch_interval_ms`), then `chatWithHistory(char, ...)` then `processAIReply(char, ...)`, then `markHandled(char, msg.uid)`, then loops back. Each iteration is wrapped in try/catch so one character's transient error doesn't kill the others.

### Module responsibilities

All modules are **parameterized by `Character`** (from `src/character.ts`) — there are no module-level globals for config or state. A `Character` is `{ name, dir, conf, prompt }` where `dir` is `characters/<name>`, `conf` is the parsed `conf.toml`, and `prompt` is the `prompt.md` contents. The OpenAI `client` in `ai.ts` is a single shared instance (DeepSeek key is global).

- **`src/character.ts`** — `Character`/`CharacterConf` types; `loadCharacters()` scans `characters/*/` and loads each dir that has both `conf.toml` and `prompt.md` (skips incomplete dirs with a warning). Parses TOML via `smol-toml`; applies defaults for optional `[bot]` fields. SMTP/IMAP `secure` (true = implicit TLS, false = STARTTLS) is per-character — Outlook.com SMTP is `secure = false` on port 587.
- **`src/mail.ts`** — IMAP fetch (`imapflow`) + SMTP send (`nodemailer`) for a character's own credentials. `onReceive(char)` resolves a Promise on the first unseen email **without touching seen state** — `markHandled(char, uid)` (server `\Seen` flag + local `seen.json` dedup) is only called after the reply is complete, so a crashed/failed reply leaves the email unread for retry on restart. Config from `char.conf`.
- **`src/ai.ts`** — shared DeepSeek client + per-character history under `char.dir/senders/`. `chatWithHistory(char, sender, content)` uses `char.prompt` and `char.conf.bot.model`, appends the sender's persisted history, and pushes both sides of the exchange back to the history file. `withCurrentTime()` prepends the current time to every user message (main, crontab, and proactive all go through it). `extractReply()` splits the model's reply into `{subject, body}` (first line = subject) and filters out lines matching `/同意回复/`. Also exports sender-list helpers used by the API: `listSenders(char)`, `deleteSender(char, sender)`, `ensureSender(char, sender)`, and the URL-safe id codecs `encodeSenderId`/`decodeSenderId`.
- **`src/api.ts`** — Hono server (`@hono/node-server`) on `127.0.0.1`, started fire-and-forget from `main.mts`. Reuses the loaded `Character[]`; state is file-based so the loops stay in sync with API writes. All handlers wrap errors and return 4xx/5xx JSON instead of crashing.
- **`src/replyHandler.ts`** — `processAIReply(char, sender, text)` dispatches on the model's output: `__SKIP__` → no-op; `__LATER__(<ISO time>)` → `addTask(char, ...)`; otherwise `extractReply` + `sendEmail(char, ...)`. Returns a status string (`skip | later | sent | no_reply`).
- **`src/scheduler.ts`** — per-character file-based "crontab" (`char.dir/crontab.json`) of tasks `{id, sender, scheduledAt}`. When a task is due it removes it and asks the AI whether to reply now, then routes through `processAIReply`.
- **`src/proactive.ts`** — per character, for each sender with history, with probability `exp(-exchangeCount * 0.3)` (decays as conversation grows), prompts the model to send an unsolicited message. Enforces a minimum gap (`char.conf.bot.proactive_min_gap_ms`) via `char.dir/proactive_tracker.json`. Only updates the tracker when a message is actually sent. Uses `char.conf.bot.proactive_model`.
- **`src/utils/checkLock.mts`** — single global PID lock (`characters/.lock`); exits if the file exists. Note: it only checks existence, not liveness, so a stale lock file blocks startup.

### AI reply protocol (defined in each character's `prompt.md`)

The model must output exactly one of:
- `__SKIP__` — no reply needed (spam/thanks/auto-reply)
- `__LATER__(<ISO time>)` — reply should be scheduled
- First line = email subject, remaining lines = body

### State files (all under `characters/<name>/`, gitignored except `prompt.md`)

- `senders/<base64(sender)>.json` — per-sender chat history as an OpenAI `ChatCompletionMessageParam[]`. Filename is the sender string base64-encoded; `proactive_tracker.json` keys by the raw (quoted) sender string instead — keep both in mind when addressing senders.
- `seen.json` — array of seen email UIDs.
- `crontab.json` — pending scheduled tasks (runtime).
- `proactive_tracker.json` — last proactive message time per sender.
- `conf.toml` — IMAP/SMTP credentials + per-character settings (gitignored).

## Gotchas

- **`conf.toml` is gitignored** (contains credentials). `prompt.md` is tracked. A new character needs both files to be loaded.
- **Mixed model usage**: main replies use `conf.bot.model` (default `deepseek-chat`); proactive messages use `conf.bot.proactive_model` (default `deepseek-v4-flash`).
- **Import style is inconsistent**: most modules import with `.ts`/`.mts` extensions (`./mail.ts`, `./checkLock.mts`); keep `.ts` extensions when adding new imports.
- **History grows unbounded** — every exchange is appended to the sender file with no truncation, so histories can become large.
- **Prompt is data**: changing behavior means editing `characters/<name>/prompt.md` (tracked), not code. The proactive module appends its own Chinese instruction to the same prompt.
- `characters/*/conf.toml` must be present with valid credentials; the bot connects to real SMTP/IMAP servers and will send real email.
