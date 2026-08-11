import "dotenv/config";
import { loadCharacters, type Character } from "./character.ts";
import { markHandled, onReceive } from "./mail.ts";
import { chatWithHistory } from "./ai.ts";
import { processAIReply } from "./replyHandler.ts";
import { rememberExchange } from "./memory.ts";
import { isBanned } from "./ban.ts";
import { CRONTAB_CHECK_MS, processCrontab } from "./scheduler.ts";
import { startProactive } from "./proactive.ts";
import { startApi } from "./api/index.ts";
import "./utils/checkLock.mts";
import { sleep } from "./utils/utils.ts";

async function runReceiveLoop(char: Character) {
    while (true) {
        try {
            const msg = await onReceive(char);
            console.log(
                `[${char.name}] Received: "${msg.subject}" from ${msg.from} at ${msg.date}`,
            );

            // Permanently banned senders are never answered: mark handled, no AI call.
            if (isBanned(char, msg.from)) {
                console.log(`[${char.name}] Skipped banned sender ${msg.from}`);
                await markHandled(char, msg.uid);
                continue;
            }

            const emailText = `Date: ${msg.date}\nSubject: ${msg.subject}\nFrom: ${msg.from}\n\n${msg.text}`;
            const text = await chatWithHistory(char, msg.from, emailText);

            await processAIReply(char, msg.from, text);

            // After every handled email, ask the memory keeper whether to remember it.
            // Its own try/catch: a failed extraction must never re-open the email.
            try {
                await rememberExchange(char, msg.from);
            } catch (e) {
                console.error(`[${char.name}] memory write failed:`, e);
            }

            await markHandled(char, msg.uid);
        } catch (e) {
            // Keep other characters alive; the failing email stays unseen and is retried.
            console.error(`[${char.name}] error:`, e);
            await sleep(char.conf.bot.fetch_interval_ms);
        }
    }
}

function main() {
    const chars = loadCharacters();
    console.log(`Mailer AI started. Characters: ${chars.map((c) => c.name).join(", ") || "(none)"}`);

    startApi(chars);

    for (const char of chars) {
        setInterval(() => processCrontab(char), CRONTAB_CHECK_MS);
        startProactive(char);
        runReceiveLoop(char); // fire-and-forget; each character loops independently
    }
}

main();
