import "dotenv/config";
import { onReceive } from "./mail.ts";
import { chatWithHistory } from "./ai.ts";
import { processAIReply } from "./replyHandler.ts";
import { CRONTAB_CHECK_MS, processCrontab } from "./scheduler.ts";
import { startProactive } from "./proactive.ts";
import "./utils/checkLock.mts";

async function main() {
    console.log("Mailer AI started. Waiting for emails...");

    setInterval(processCrontab, CRONTAB_CHECK_MS);
    startProactive();

    while (true) {
        const msg = await onReceive();
        console.log(`Received: "${msg.subject}" from ${msg.from} at ${msg.date}`);
        const text = await chatWithHistory(
            msg.from,
            `Date: ${msg.date}\nProcess: ${new Date().toISOString()}\nSubject: ${msg.subject}\nFrom: ${msg.from}\n\n${msg.text}`,
        );

        await processAIReply(msg.from, text);
    }
}

await main();
