import "dotenv/config";
import { loadCharacters, type Character } from "./character.ts";
import { markHandled, onReceive } from "./mail.ts";
import { chatWithHistory } from "./ai.ts";
import { processAIReply } from "./replyHandler.ts";
import { CRONTAB_CHECK_MS, processCrontab } from "./scheduler.ts";
import { startProactive } from "./proactive.ts";
import { startApi } from "./api.ts";
import "./utils/checkLock.mts";

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function runReceiveLoop(char: Character) {
    while (true) {
        try {
            const msg = await onReceive(char);
            console.log(
                `[${char.name}] Received: "${msg.subject}" from ${msg.from} at ${msg.date}`,
            );
            const text = await chatWithHistory(
                char,
                msg.from,
                `Date: ${msg.date}\nSubject: ${msg.subject}\nFrom: ${msg.from}\n\n${msg.text}`,
            );

            await processAIReply(char, msg.from, text);
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
