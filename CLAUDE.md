# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mailer AI is an always-on email auto-reply bot. It polls an IMAP inbox, feeds each new email plus the sender's conversation history to a DeepSeek chat model, and acts on the model's structured reply (skip / schedule for later / send a reply). It can also proactively start conversations with senders it has history with. Personality and behavior rules live entirely in `data/prompt.txt` (a "philosophical beggar" persona).

## Commands

- **Run**: `pnpm start` — runs `tsx watch src/main.mts`, so it auto-restarts on file changes. This is the only real workflow.
- **Install**: `pnpm install`
- **Typecheck**: `npx tsc --noEmit` (tsconfig has `noEmit: true`; there is no build step).
- **Tests**: none. `pnpm test` just prints an error. Verify changes by running the bot and watching logs.

## Architecture

Entry point `src/main.mts` wires three independent loops, then blocks in a `while(true)` receive loop:

1. `setInterval(processCrontab, 60000)` — fires due scheduled tasks.
2. `startProactive()` — every `PROACTIVE_INTERVAL_MS` (default 300000), may message senders with existing history.
3. Main loop: `onReceive()` (blocks until an unseen email arrives, polling every `FETCH_INTERVAL_MS`), then `chatWithHistory(from, ...)` then `processAIReply(from, text)`, then `markHandled(msg.uid)`, then loops back.

### Module responsibilities

- **`src/mail.ts`** — IMAP fetch (`imapflow`) + SMTP send (`nodemailer`). `onReceive()` resolves a Promise on the first unseen email **without touching seen state** — the main loop calls `markHandled(uid)` only after the reply is complete, so a crashed/failed reply leaves the email unread for retry on restart. `markHandled` sets the server `\Seen` flag and records the UID in `data/seen.json` for dedup. Config from env.
- **`src/ai.ts`** — DeepSeek client (OpenAI SDK, `baseURL`/`apiKey` from env). Loads the system prompt from `data/prompt.txt`, appends the sender's persisted history, calls `chatWithHistory`, and pushes both sides of the exchange back to the history file. `extractReply()` splits the model's reply into `{subject, body}` (first line = subject) and filters out lines matching `/同意回复/`.
- **`src/replyHandler.ts`** — dispatches on the model's output: `__SKIP__` → no-op; `__LATER__(<ISO time>)` → adds a scheduled task; otherwise `extractReply` + `sendEmail`. Returns a status string (`skip | later | sent | no_reply`).
- **`src/scheduler.ts`** — file-based "crontab" (`data/crontab.json`) of tasks `{id, sender, scheduledAt}`. When a task is due it removes it and asks the AI whether to reply now, then routes through `processAIReply`.
- **`src/proactive.ts`** — for each sender with history, with probability `exp(-exchangeCount * 0.3)` (decays as conversation grows), prompts the model to send an unsolicited message. Enforces a 1-hour minimum gap per sender via `data/proactive_tracker.json`. Only updates the tracker when a message is actually sent.
- **`src/utils/checkLock.mts`** — PID lock (`data/app.lock`); exits if the file exists. Note: it only checks existence, not liveness, so a stale lock file blocks startup.

### AI reply protocol (defined in `data/prompt.txt`)

The model must output exactly one of:
- `__SKIP__` — no reply needed (spam/thanks/auto-reply)
- `__LATER__(<ISO time>)` — reply should be scheduled
- First line = email subject, remaining lines = body

### State files (all under `data/`, gitignored except `prompt.txt`)

- `data/senders/<base64(sender)>.json` — per-sender chat history as an OpenAI `ChatCompletionMessageParam[]`. Filename is the sender string base64-encoded; `data/proactive_tracker.json` keys by the raw (quoted) sender string instead — keep both in mind when addressing senders.
- `data/seen.json` — array of seen email UIDs.
- `data/crontab.json` — pending scheduled tasks (created at runtime, not committed).
- `data/proactive_tracker.json` — last proactive message time per sender.
- `data/app.lock` — PID lock file.

## Gotchas

- **Mixed model usage**: main replies use `deepseek-chat`; proactive messages use `deepseek-v4-flash` (hardcoded in `proactive.ts`).
- **Import style is inconsistent**: most modules import with `.ts`/`.mts` extensions (`./mail.ts`, `./checkLock.mts`), but `scheduler.ts` imports `./ai` and `./replyHandler` without them. `tsx` tolerates both; keep `.ts` extensions when adding new imports.
- **History grows unbounded** — every exchange is appended to the sender file with no truncation, so histories can become large.
- **Prompt is data**: changing behavior means editing `data/prompt.txt` (it's the only committed file in `data/`), not code. The proactive module appends its own Chinese instruction to the same prompt.
- `.env` must be present with valid credentials (see `.env.example`); the bot connects to real SMTP/IMAP servers and will send real email.
