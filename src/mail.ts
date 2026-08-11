import nodemailer from "nodemailer";
import { ImapFlow, type ImapFlowOptions } from "imapflow";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { simpleParser } from "mailparser";
import type { Character } from "./character.ts";
import { normalizeSender } from "./sender.ts";

function seenFile(char: Character): string {
    return `${char.dir}/seen.json`;
}

function getSeenUids(char: Character): Set<number> {
    const file = seenFile(char);
    if (!existsSync(file)) return new Set();
    const data = readFileSync(file, "utf-8");
    return new Set(JSON.parse(data));
}

function saveSeenUid(char: Character, uid: number) {
    const seen = getSeenUids(char);
    seen.add(uid);
    writeFileSync(seenFile(char), JSON.stringify([...seen]));
}

function smtpConfig(char: Character) {
    return {
        host: char.conf.smtp.host,
        port: char.conf.smtp.port,
        secure: char.conf.smtp.secure,
        auth: {
            user: char.conf.smtp.user,
            pass: char.conf.smtp.pass,
        },
    };
}

function imapConfig(char: Character): ImapFlowOptions {
    return {
        host: char.conf.imap.host,
        port: char.conf.imap.port,
        secure: char.conf.imap.secure,
        auth: {
            user: char.conf.imap.user,
            pass: char.conf.imap.pass,
        },
        logger: false,
    };
}

export async function sendEmail(char: Character, to: string, subject: string, text: string) {
    const transporter = nodemailer.createTransport(smtpConfig(char));
    const info = await transporter.sendMail({
        from: char.conf.smtp.user,
        to,
        subject,
        text,
    });
    return info;
}

export async function fetchUnseenEmails(char: Character) {
    const client = new ImapFlow(imapConfig(char));
    await client.connect();

    try {
        const lock = await client.getMailboxLock("INBOX");
        try {
            const seenUids = getSeenUids(char);
            const messages: EmailMessage[] = [];

            for await (const msg of client.fetch({ seen: false }, { source: true })) {
                if (seenUids.has(msg.uid)) continue;
                const parsed = await simpleParser(msg.source!);
                const fromObj = parsed.from;
                messages.push({
                    subject: parsed.subject ?? "",
                    // Normalize to the bare email so display-name and plain forms of the
                    // same sender always map to one conversation.
                    from: normalizeSender(
                        (Array.isArray(fromObj) ? fromObj[0] : fromObj)?.value?.[0]?.address
                            ?? parsed.from?.text
                            ?? "",
                    ),
                    text: parsed.text ?? "",
                    uid: msg.uid,
                    date: parsed.date?.toISOString() ?? "",
                });
            }

            return messages;
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
}

export async function markAsSeen(char: Character, uids: number[]) {
    const client = new ImapFlow(imapConfig(char));
    await client.connect();

    try {
        const lock = await client.getMailboxLock("INBOX");
        try {
            await client.messageFlagsAdd(uids, ["\\Seen"]);
        } finally {
            lock.release();
        }
    } finally {
        await client.logout();
    }
}

/** Mark an email as handled (server \Seen flag + local dedup) after its reply is complete. */
export async function markHandled(char: Character, uid: number) {
    await markAsSeen(char, [uid]);
    saveSeenUid(char, uid);
}

export type EmailMessage = { subject: string; from: string; text: string; uid: number; date: string };

export function onReceive(char: Character): Promise<EmailMessage> {
    const fetchInterval = char.conf.bot.fetch_interval_ms;
    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const messages = await fetchUnseenEmails(char);
                if (messages.length > 0) {
                    resolve(messages[0]);
                } else {
                    process.stdout.write(`[${char.name}] No New Emails Since ${(new Date()).toLocaleTimeString("en-US")}\r`);
                    setTimeout(poll, fetchInterval);
                }
            } catch (e) {
                reject(e);
            }
        };
        poll();
    });
}
