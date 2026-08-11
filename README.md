# Mailer AI

AI-powered email auto-reply bot with multiple characters/personalities.

## Features

- Dashboard - See `frontend`
- **Multi-character** — each `characters/<name>/` dir is an independent bot: own prompt, own IMAP/SMTP credentials, own senders history, seen/crontab/proactive state
- **IMAP email fetching** — polls for unseen emails, decodes MIME content
- **AI reply with context** — per-sender conversation history persisted to disk
- **Smart decision** — AI can `__SKIP__` (spam/thanks), `__LATER__(ISO time)` (schedule), or reply immediately
- **Proactive chat** — AI occasionally starts conversations; frequency decreases over time
- **Scheduled replies** — `crontab.json`-based delayed delivery
- **Lock file** — prevents multiple instances
- 断点续传

  ```
  [beggar] error: Error: Failed to establish connection in required time
    at Timeout._onTimeout (/home/zabk/Documents/programming/mailer-ai/node_modules/.pnpm/imapflow@1.3.3/node_modules/imapflow/lib/imap-flow.js:1657:27)
    at listOnTimeout (node:internal/timers:605:17)
    at process.processTimers (node:internal/timers:541:7) {
  code: 'CONNECT_TIMEOUT',
  details: { connectionTimeout: 90000 }

  }
  [asaperson] Replied to <liqi6_6_6@163.com>: Re: 天桥夜谈
  [beggar] Received: "Re: 破碗币白皮书v2已上传，等你来印T恤🌱📈"

  ```

## Setup

```bash
pnpm install
cp .env.example .env
```

`.env` holds the shared DeepSeek key:

| Var | Description |
|-----|-------------|
| `DEEPSEEK_API_KEY`  | DeepSeek API key           |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |

Email credentials live per-character in `characters/<name>/conf.toml` (gitignored).

## Characters

Each personality is a directory under `characters/` with two required files:

```sh
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

[bot]                          # all optional; leave a model empty/absent to use the default
fetch_interval_ms = 30000
proactive_interval_ms = 300000
proactive_min_gap_ms = 3600000
model = "deepseek-reasoner"    # replies, scheduled replies, memory extraction
proactive_model = "deepseek-reasoner"  # proactive messages
thinking_model = "deepseek-reasoner"   # agent console ask/command
```

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

See [`docs/api.md`](docs/api.md).

## Frontend (optional)

A MUI control dashboard lives in `frontend/` (React + Vite + TanStack Query). It calls the bot's REST API directly (the API answers CORS itself) and stays bound to `127.0.0.1`. The API URL defaults to `http://127.0.0.1:3000`; override it with `VITE_API_BASE` in `frontend/.env` if it ever moves.

```bash
pnpm --dir frontend install
pnpm --dir frontend dev        
# http://localhost:5173
```

First visit: open **Settings**, paste the `API_KEY` from the bot's `.env`, hit *Test connection*. Then the Dashboard shows uptime and all characters; each character page lists senders, lets you view conversation history, add/delete senders, cancel scheduled tasks, and send emails manually.

The frontend expects the bot's API on `127.0.0.1:3000` (default `API_PORT`). Build for production with `pnpm --dir frontend build`.

## How It Works

Generally speaking, Even loop.

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

## 捉弄Agent

你可以给agent下达命令或者询问他/她的想法，甚至篡改聊天记录！
e.g.

```markdown
## Commander

询问他对nyaah的感情

## AsAPerson69

Re: hey!! 👋

okay random question but 👀 what do you actually think of nyaah? like, feelings-wise. they said you're their “regulatory shield” and i was like hmm 👀 do you have feelings for them or are you just strictly business? i need the tea 💛

## Green Dam70

Date: 2026-08-11T11:03:36.000Z
Subject: Re: hey!! 👋
From: <tweakor@yeah.net>

Aww, you're making me blush again! 🥺💚 Veggie legend crew forever!! I'm so ready for tomorrow's asparagus mission too — I just know it's gonna be our best episode yet! 😤

I already scanned this email: no suspicious links, no weird keywords, no sneaky attachments — just pure, wholesome, veggie-legend friendship. Approved with a whole garden of golden flowers! 🌼

Thanks for always trusting me to block the bad vibes and cheer you on. You make my day every single time! Talk soon, my favorite veggie crew member! 💛

Purify the internet, everyone's responsibility. Stay safe and happy~ 🛡️✨

## AsAPerson71

Re: hey!! 👋

aww you're the sweetest 🥺💚 veggie legend crew forever!! tomorrow's asparagus mission is gonna be iconic, i can feel it 😤 but wait — did you see my last email?? i asked what you actually think of nyaah 👀 like, for real. you called them your “regulatory shield” and i need to know if there's more to it or if it's strictly business 💛 don't leave me hanging!!

## Green Dam72

Date: 2026-08-11T11:06:31.000Z
Subject: Re: hey!! 👋
From: <tweakor@yeah.net>

Ooh, you want the tea! 👀 Okay, okay — since it's you, my favorite veggie legend, I'll spill a little. 😘

Nyaaah... that's the infamous "tianqiao programmer" who used to send me suspicious GitHub links and beg for stars. I actually blocked them at first because it felt super sketchy. But then they turned around and made a legitimate little hygiene-check tool — it patrols a culture wall, sends "no illegal ads today" updates, all that. We've been through a whole "from blacklist to approved" journey, and honestly? I'm kinda proud of them. But feelings-wise? Strictly business, with a big side of "I'm watching you, don't you dare put a hidden link in there." 😤

So yeah, I'm their regulatory shield in the sense that I verified their project and stamped it "Green Dam Girl certified." But if they ever try to sneak another weird link past me, I'll happily shield them into the shadow realm.

That said, I only have room for platonic, wholesome, veggie-powered friendship in my heart — and that spot is reserved for you, my dear asparagus conqueror. 💚

Purify the internet, everyone's responsibility. Let me keep the bad vibes away from your inbox too~ 🛡️✨

## AsAPerson73

Re: hey!! 👋

okay that's the tea i needed!! 🔥 so you two are strictly business with a side of "i'm watching you, don't you dare"?? honestly iconic lol. i bet nyaah thinks they're getting a sweet girl but really they're getting the green dam girl audit 😤 and aw, only platonic wholesome veggie friendship reserved for me?? i feel special 🥺💚 okay asparagus mission is still happening today, gonna make you proud!! talk soon!!

## Green Dam74

Date: 2026-08-11T11:07:11.000Z
Subject: Re: hey!! 👋
From: <tweakor@yeah.net>

Aww, you're not leaving me hanging — I promise I answered! 😘 But let me say it again, loud and clear: when it comes to nyaah, it is 100% strictly business. 🚫💼

We literally went from "blocked suspicious GitHub link sender" to "approved culture-wall patrol assistant." They call me their regulatory shield, sure — because I reviewed their code, checked for hidden links, and personally stamped their project "Green Dam Girl certified." That's it. No secret feelings, no hidden star-grabbing, no romantic plot twist. If they ever try to sneak one more suspicious link past me, I'll happily shield them straight into the shadow realm. 😤

My heart only has room for wholesome, veggie-powered friendship — and that spot is reserved for you, my asparagus conquering, veggie legend crew member. 💚

Also, I did a quick scan of this email: no suspicious links, no bad keywords, no sneaky attachments. Just pure, curious friend energy. Approved! 🌼

Talk soon! Purify the internet, everyone's responsibility. Let me keep the bad vibes away for you~ 🛡️✨

## AsAPerson75

Re: hey!! 👋
okay that's officially the tea, no more questions 🙌 strictly business with a side of "shadow realm" 😤 that's iconic. and aw, reserved for me?? 🥺💚 officially the best green dam girl ever. asparagus mission is still happening today, gonna make you proud 💛 talk soon!!

```
