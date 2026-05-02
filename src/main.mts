import "dotenv/config";
import { onReceive, sendEmail } from "./mail.ts";
import { chatWithHistory, proactiveChat, loadHistory, saveHistory } from "./ai.ts";
import { addTask, getDueTasks, removeTask, parseLaterTime } from "./scheduler.ts";
import "./utils/checkLock.mts";
import { randomUUID } from "crypto";

const CRONTAB_CHECK_MS = 60000;

function extractReply(text: string): { subject: string; body: string } | null {
    const lines = text.trim().split("\n");
    const filtered = lines.filter((l) => !/同意回复/.test(l));
    const subject = filtered[0];
    const body = filtered.slice(1).join("\n").trim();
    if (!subject) return null;
    return { subject, body };
}

function handleLater(text: string): Date | null {
    const m = text.match(/__LATER__\(([^)]+)\)/);
    if (!m) return null;
    return parseLaterTime(m[1]);
}

async function processCrontab() {
    const due = getDueTasks();
    for (const task of due) {
        try {
            await sendEmail(task.sender, task.subject, task.body);
            console.log(`[Crontab] Sent scheduled reply to ${task.sender}`);
            removeTask(task.id);

            // Save the scheduled reply to conversation history
            const history = loadHistory(task.sender);
            history.push({ role: "assistant", content: `${task.subject}\n${task.body}` });
            saveHistory(task.sender, history);

            // Proactive chat after scheduled reply
            const pro = await proactiveChat(task.sender);
            if (pro) {
                const r = extractReply(pro);
                if (r) {
                    await sendEmail(task.sender, r.subject, r.body);
                    console.log(`[Proactive] Chatted with ${task.sender}: ${r.subject}`);
                }
            }
        } catch (e) {
            console.error(`[Crontab] Failed to send scheduled reply:`, e);
        }
    }
}

async function main() {
    console.log("Mailer AI started. Waiting for emails...");

    // Periodically check crontab
    setInterval(processCrontab, CRONTAB_CHECK_MS);

    while (true) {
        const msg = await onReceive();
        console.log(`Received: "${msg.subject}" from ${msg.from}`);
        const text = await chatWithHistory(
            msg.from,
            `Subject: ${msg.subject}\nFrom: ${msg.from}\n\n${msg.text}`,
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
                // Save AI response to history
                const history = loadHistory(msg.from);
                history.push({ role: "assistant", content: text });
                saveHistory(msg.from, history);

                const r = extractReply(text.replace(/__LATER__\([^)]+\)/, "").trim());
                if (r) {
                    addTask({
                        id: randomUUID(),
                        sender: msg.from,
                        subject: r.subject,
                        body: r.body,
                        scheduledAt: laterTime.toISOString(),
                    });
                    console.log(`Scheduled reply to ${msg.from} at ${laterTime.toISOString()}`);
                }
            } else {
                console.log(`Could not parse later time, skipping reply to ${msg.from}`);
            }
            continue;
        }

        const r = extractReply(text);
        if (!r) {
            console.log(`Could not parse reply for ${msg.from}, skipping`);
            continue;
        }

        // Reply as Default
        await sendEmail(msg.from, r.subject, r.body);
        console.log(`Replied to ${msg.from}: ${r.subject}`);

        // Proactive chat after reply
        const pro = await proactiveChat(msg.from);
        if (pro) {
            const pr = extractReply(pro);
            if (pr) {
                await sendEmail(msg.from, pr.subject, pr.body);
                console.log(`[Proactive] Chatted with ${msg.from}: ${pr.subject}`);
            }
        }
        /* End Main Loop */
    }
}

await main();
