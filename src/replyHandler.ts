import { sendEmail } from "./mail.ts";
import { addTask, handleLater } from "./scheduler.ts";
import { extractReply } from "./ai.ts";
import { randomUUID } from "crypto";
import type { Character } from "./character.ts";

export async function processAIReply(
    char: Character,
    sender: string,
    text: string,
): Promise<"skip" | "later" | "sent" | "no_reply"> {
    if (text.includes("__SKIP__")) {
        console.log(`[${char.name}] Skipped reply to ${sender}`);
        return "skip";
    }

    if (text.includes("__LATER__")) {
        const laterTime = handleLater(text);
        if (laterTime) {
            addTask(char, {
                id: randomUUID(),
                sender,
                scheduledAt: laterTime.toISOString(),
            });
            console.log(
                `[${char.name}] Scheduled check-in for ${sender} at ${laterTime.toISOString()}`,
            );
            return "later";
        }
        console.log(`[${char.name}] Invalid LATER time from ${sender}, skipping`);
        return "skip";
    }

    const r = extractReply(text);
    if (!r) {
        console.log(`[${char.name}] Could not parse reply from ${sender}, skipping`);
        return "no_reply";
    }

    await sendEmail(char, sender, r.subject, r.body);
    console.log(`[${char.name}] Replied to ${sender}: ${r.subject}`);
    return "sent";
}
