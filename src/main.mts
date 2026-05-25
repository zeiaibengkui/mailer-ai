import "dotenv/config";
import { onReceive, sendEmail } from "./mail.ts";
import {
    chatWithHistory,
    loadHistory,
    saveHistory,
    extractReply,
} from "./ai.ts";
import {
    addTask, CRONTAB_CHECK_MS, handleLater, processCrontab
} from "./scheduler.ts";
import { startProactive } from "./proactive.ts";
import "./utils/checkLock.mts";
import { randomUUID } from "crypto";

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

        // Skip
        if (text.includes("__SKIP__")) {
            console.log(`Skipped reply to ${msg.from}`);
            continue;
        }

        // Later
        if (text.includes("__LATER__")) {
            const laterTime = handleLater(text);
            if (laterTime) {
                const history = loadHistory(msg.from);
                history.push({ role: "assistant", content: text });
                saveHistory(msg.from, history);

                addTask({
                    id: randomUUID(),
                    sender: msg.from,
                    scheduledAt: laterTime.toISOString(),
                });
                console.log(
                    `Scheduled check-in for ${msg.from} at ${laterTime.toISOString()}`,
                );
            } else {
                console.log(
                    `Could not parse later time, skipping reply to ${msg.from}`,
                );
            }
            continue;
        }

        const r = extractReply(text);
        if (!r) {
            console.log(`Could not parse reply for ${msg.from}, skipping`);
            continue;
        }

        await sendEmail(msg.from, r.subject, r.body);
        console.log(`Replied to ${msg.from}: ${r.subject}`);
    }
}

await main();
