# Mailer AI

AI-powered email auto-reply bot with catgirl personality. Uses DeepSeek to read, decide, and reply to emails via IMAP/SMTP.

## Features

- **IMAP email fetching** — polls for unseen emails, decodes MIME content
- **AI reply with context** — per-sender conversation history persisted to disk
- **Smart decision** — AI can `__SKIP__` (spam/thanks), `__LATER__(ISO time)` (schedule), or reply immediately
- **Proactive chat** — AI occasionally starts conversations; frequency decreases over time
- **Scheduled replies** — `crontab.json`-based delayed delivery
- **Lock file** — prevents multiple instances

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill in `.env`:

| Var | Description |
|-----|-------------|
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
| `SMTP_HOST` / `SMTP_PORT` | SMTP server (e.g. `smtp.163.com:465`) |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials |
| `IMAP_HOST` / `IMAP_PORT` | IMAP server (e.g. `imap.163.com:993`) |
| `IMAP_USER` / `IMAP_PASS` | IMAP credentials |
| `FETCH_INTERVAL_MS` | Poll interval (default `30000`) |

## Run

```bash
pnpm start
```

Uses `tsx watch` — auto-restarts on file changes.

## Project Structure

```
src/
├── main.mts          # Main loop: receive → AI → reply
├── mail.ts           # IMAP fetch + SMTP send
├── ai.ts             # DeepSeek client + history management + proactive chat
├── scheduler.ts      # Crontab for delayed replies
└── utils/
    └── checkLock.mts # PID lock file

data/
├── prompt.txt        # System prompt (catgirl personality)
├── .env              # Credentials (gitignored)
├── senders/          # Per-sender conversation history
├── crontab.json      # Scheduled tasks
├── seen.json         # Local UID dedup
└── app.lock          # Instance lock
```

## How It Works

1. Polls IMAP for unseen emails every `FETCH_INTERVAL_MS`
2. Parses MIME content, deduplicates via local `seen.json`
3. Loads conversation history for the sender
4. Calls DeepSeek with system prompt + history
5. Acts on response:
   - `__SKIP__` → do nothing
   - `__LATER__(ISO time)` → schedule for later
   - else → send reply, optionally proactive chat afterwards

## Prompt

Edit `data/prompt.txt` to change the AI personality and behavior rules.
