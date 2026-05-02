import "dotenv/config";
import { onReceive, sendEmail } from "./mail.js";
import { client, prompt } from "./ai.js";

async function main() {
    console.log("Mailer AI started. Waiting for emails...");

    while (true) {
        const msg = await onReceive();
        console.log(`Received: "${msg.subject}" from ${msg.from}`);

        const reply = await client.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: prompt },
                {
                    role: "user",
                    content: `Subject: ${msg.subject}\nFrom: ${msg.from}\n\n${msg.text}`,
                },
            ],
        });

        const text = reply.choices[0]?.message?.content ?? "__SKIP__";

        if (text.trim() === "__SKIP__") {
            console.log(`Skipped reply to ${msg.from}`);
        } else {
            await sendEmail(msg.from, `Re: ${msg.subject}`, text);
            console.log(`Replied to ${msg.from}`);
        }
    }
}

await main();
