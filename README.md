# Mailer AI

AI-powered email auto-reply bot with multiple characters/personalities. Uses DeepSeek to read, decide, and reply to emails via IMAP/SMTP. Each character has its own prompt, its own email inbox, and its own conversation history.

## Features

- **Multi-character** — each `characters/<name>/` dir is an independent bot: own prompt, own IMAP/SMTP credentials, own senders history, seen/crontab/proactive state
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

`.env` holds the shared DeepSeek key:

| Var | Description |
|-----|-------------|
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |

Email credentials live per-character in `characters/<name>/conf.toml` (gitignored).

## Characters

Each personality is a directory under `characters/` with two required files:

```
characters/<name>/
├── prompt.md            # personality / behavior rules (tracked)
├── conf.toml            # email creds + per-character settings (gitignored)
├── senders/             # per-sender conversation history
├── seen.json            # seen email UIDs
├── crontab.json         # scheduled tasks (runtime)
└── proactive_tracker.json # last proactive message per sender
```

`conf.toml`:

```toml
[smtp]
host = "smtp.163.com"
port = 465
secure = true                  # true = implicit TLS (465), false = STARTTLS (587)
user = "you@163.com"
pass = "your-password"

[imap]
host = "imap.163.com"
port = 993
secure = true
user = "you@163.com"
pass = "your-password"

[bot]                          # all optional, defaults shown
fetch_interval_ms = 30000
proactive_interval_ms = 300000
proactive_min_gap_ms = 3600000
model = "deepseek-chat"
proactive_model = "deepseek-v4-flash"
```

Example: Outlook.com uses IMAP `outlook.office365.com:993` (secure) and SMTP `smtp-mail.outlook.com:587` (`secure = false`, STARTTLS).

Add a new character by creating `characters/<name>/prompt.md` + `conf.toml`. The bot picks it up on next start.

## Run

```bash
pnpm start
```

Uses `tsx watch` — auto-restarts on file changes. One receive/crontab/proactive loop set runs per character.

## Register a Contact

```bash
pnpm add-sender <character> "friend@example.com"
```

Registers an email address for a character so it will start proactively messaging them on the next proactive tick (creates an empty history file in `characters/<name>/senders/`).

## REST Control API

Full reference: [`docs/api.md`](docs/api.md). The bot exposes a JSON API on `127.0.0.1` while running. Configure in `.env`:

| Var | Description |
|-----|-------------|
| `API_PORT` | Port to listen on (default `3000`) |
| `API_KEY` | **Required** — the bot exits at startup if missing. Generate with `openssl rand -hex 24`. Auth is always on: every request needs `Authorization: Bearer <API_KEY>`. |

Sender `id`s in URLs are the sender string encoded as URL-safe base64 (the `/characters/:name/senders` response includes both `id` and the decoded `sender`).

| Method | Path | Action |
|---|---|---|
| GET | `/health` | liveness check |
| GET | `/status` | uptime + per-character summary |
| GET | `/characters` | all characters with sender lists |
| GET | `/characters/:name` | character config + senders + tasks |
| GET | `/characters/:name/senders` | list known senders |
| GET | `/characters/:name/senders/:senderId` | conversation history |
| POST | `/characters/:name/senders` | register a sender — body `{ "sender": "friend@example.com" }` |
| DELETE | `/characters/:name/senders/:senderId` | delete a sender's history |
| GET | `/characters/:name/tasks` | scheduled `__LATER__` tasks |
| DELETE | `/characters/:name/tasks/:id` | cancel a scheduled task |
| POST | `/characters/:name/messages` | send manually — body `{ "to", "subject", "body" }` |

Examples:

```bash
curl localhost:3000/health
curl localhost:3000/characters
curl -X POST localhost:3000/characters/beggar/senders \
  -H 'content-type: application/json' \
  -d '{"sender":"friend@example.com"}'
curl -X POST localhost:3000/characters/asaperson/messages \
  -H 'content-type: application/json' \
  -d '{"to":"friend@example.com","subject":"hi","body":"whats up"}'
```

## Frontend (optional)

A MUI control dashboard lives in `frontend/` (React + Vite + TanStack Query). It talks to the bot through a Vite dev proxy, so the API stays bound to `127.0.0.1`.

```bash
pnpm --dir frontend install
pnpm --dir frontend dev        # http://localhost:5173
```

First visit: open **Settings**, paste the `API_KEY` from the bot's `.env`, hit *Test connection*. Then the Dashboard shows uptime and all characters; each character page lists senders, lets you view conversation history, add/delete senders, cancel scheduled tasks, and send emails manually.

The frontend expects the bot's API on `127.0.0.1:3000` (default `API_PORT`). Build for production with `pnpm --dir frontend build`.

## How It Works

1. For each character, polls its IMAP inbox for unseen emails every `fetch_interval_ms`
2. Parses MIME content, deduplicates via `characters/<name>/seen.json`
3. Loads conversation history for the sender
4. Calls DeepSeek with the character's `prompt.md` + history
5. Acts on response:
   - `__SKIP__` → do nothing
   - `__LATER__(ISO time)` → schedule for later
   - else → send reply
6. Marks the email seen only after the reply is complete

## Prompt

Edit `characters/<name>/prompt.md` to change a character's personality and behavior rules.
