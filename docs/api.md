# Mailer AI — REST Control API

The bot exposes a JSON API on `127.0.0.1` while `pnpm start` is running. It lets you query server status, manage a character's known senders and scheduled tasks, and send emails manually — without touching files or restarting the process.

## Configuration (`.env`)

| Var | Description |
|-----|-------------|
| `API_PORT` | Port to listen on (default `3000`) |
| `API_KEY` | Optional. If set, every request must send `Authorization: Bearer <API_KEY>`; otherwise the server responds `401`. |

The server binds to `127.0.0.1` only — it is not reachable from the network.

## Sender IDs

Endpoints that take a sender in the URL use `:senderId`, which is the sender string (e.g. `"friend@example.com"`) encoded as **URL-safe base64**. The `/characters/:name/senders` response always includes both the `id` and the decoded `sender`, so you can copy the `id` directly. The on-disk history filenames use standard base64 — don't mix the two.

Example: for sender `friend@example.com`, the URL-safe id is `ZnJpZW5kQGV4YW1wbGUuY29t`.

## Endpoints

### Health

`GET /health`

```json
{ "ok": true }
```

### Status

`GET /status` — uptime in seconds plus a per-character summary.

```json
{
  "uptimeSeconds": 42,
  "characters": [
    {
      "name": "beggar",
      "email": "liqi6_6_6@163.com",
      "model": "deepseek-chat",
      "proactiveModel": "deepseek-v4-flash",
      "senders": 2,
      "tasks": 1
    }
  ]
}
```

### Characters

`GET /characters` — all loaded characters, each with its sender list.

`GET /characters/:name` — one character's config, sender list and scheduled tasks.

Responds `404 { "error": "unknown character" }` for an unknown name.

### Senders

`GET /characters/:name/senders` — list known senders:

```json
[
  { "id": "ZnJpZW5kQGV4YW1wbGUuY29t", "sender": "friend@example.com", "exchanges": 3 }
]
```

`GET /characters/:name/senders/:senderId` — that sender's conversation history (an OpenAI message array; `[]` if empty).

`POST /characters/:name/senders` — register a sender so the proactive loop will message them.

```
body: { "sender": "friend@example.com" }
```

Responds `201 { "id": "...", "sender": "...", "created": true }` on a new sender, `200` with `"created": false` if they already existed.

`DELETE /characters/:name/senders/:senderId` — delete the sender's history file and clear their proactive gap.

```
200 { "ok": true, "sender": "friend@example.com" }
```

### Tasks

`GET /characters/:name/tasks` — pending `__LATER__` scheduled tasks:

```json
[
  { "id": "abc123", "sender": "friend@example.com", "scheduledAt": "2026-08-12T09:00:00.000Z" }
]
```

`DELETE /characters/:name/tasks/:id` — cancel a scheduled task.

```
200 { "ok": true }
```

### Send a message

`POST /characters/:name/messages` — send an email right now from this character, and record it in the recipient's history so the AI remembers sending it.

```
body: { "to": "friend@example.com", "subject": "hi", "body": "whats up" }
```

Responds `200 { "ok": true, "to": "...", "subject": "..." }`. On SMTP failure it responds `500 { "error": "send failed: <reason>" }`.

## Examples

```bash
# Health check
curl localhost:3000/health

# List everything
curl localhost:3000/characters

# Register a sender
curl -X POST localhost:3000/characters/beggar/senders \
  -H 'content-type: application/json' \
  -d '{"sender":"friend@example.com"}'

# Send a manual email from the asaperson character
curl -X POST localhost:3000/characters/asaperson/messages \
  -H 'content-type: application/json' \
  -d '{"to":"friend@example.com","subject":"hi","body":"whats up"}'

# With an API key set
curl -H "Authorization: Bearer $API_KEY" localhost:3000/status
```

## Notes

- Manual sends (`POST .../messages`) **do send real email** through the character's SMTP account.
- State is file-based and shared with the running loops: a sender registered via the API is picked up by the next proactive tick, and a task deleted via the API is gone from `crontab.json`.
