import "dotenv/config";
import { onReceive, sendEmail } from "./mail.ts";
import { chatWithHistory } from "./ai.ts";
import "./utils/checkLock.mts";

async function main() {
    console.log("Mailer AI started. Waiting for emails...");

    while (true) {
        const msg = await onReceive();
        console.log(`Received: "${msg.subject}" from ${msg.from}`);
        // console.log(msg);

        const text = await chatWithHistory(
            msg.from,
            `Subject: ${msg.subject}\nFrom: ${msg.from}\n\n${msg.text}`,
        );

        if (text.includes("__SKIP__")) {
            console.log(`Skipped reply to ${msg.from}`);
        } else {
            const lines = text.trim().split("\n");
            const filtered = lines.filter((l) => !/同意回复/.test(l));
            const subject = filtered[0];
            const body = filtered.slice(1).join("\n").trim();
            await sendEmail(msg.from, subject, body);
            console.log(`Replied to ${msg.from}`);
        }
    }
}

await main();
