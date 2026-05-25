import { sendEmail } from "./mail.ts";
import { addTask, handleLater } from "./scheduler.ts";
import { extractReply } from "./ai.ts";
import { randomUUID } from "crypto";

export async function processAIReply(
    sender: string,
    text: string,
): Promise<"skip" | "later" | "sent" | "no_reply"> {
    if (text.includes("__SKIP__")) {
        console.log(`Skipped reply to ${sender}`);
        return "skip";
    }

    if (text.includes("__LATER__")) {
        const laterTime = handleLater(text);
        if (laterTime) {
            addTask({
                id: randomUUID(),
                sender,
                scheduledAt: laterTime.toISOString(),
            });
            console.log(
                `Scheduled check-in for ${sender} at ${laterTime.toISOString()}`,
            );
            return "later";
        }
        console.log(`Invalid LATER time from ${sender}, skipping`);
        return "skip";
    }

    const r = extractReply(text);
    if (!r) {
        console.log(`Could not parse reply from ${sender}, skipping`);
        return "no_reply";
    }

    await sendEmail(sender, r.subject, r.body);
    console.log(`Replied to ${sender}: ${r.subject}`);
    return "sent";
}
