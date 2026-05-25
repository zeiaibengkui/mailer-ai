import nodemailer from "nodemailer";
import { ImapFlow, type ImapFlowOptions } from "imapflow";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { simpleParser } from "mailparser";

const SEEN_FILE = "data/seen.json";

function getSeenUids(): Set<number> {
    if (!existsSync(SEEN_FILE)) return new Set();
    const data = readFileSync(SEEN_FILE, "utf-8");
    return new Set(JSON.parse(data));
}

function saveSeenUid(uid: number) {
    const seen = getSeenUids();
    seen.add(uid);
    writeFileSync(SEEN_FILE, JSON.stringify([...seen]));
}

const SMTP_CONFIG = {
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT!),
    secure: true,
    auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
    },
};

const IMAP_CONFIG: ImapFlowOptions = {
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT!),
    secure: true,
    auth: {
        user: process.env.IMAP_USER!,
        pass: process.env.IMAP_PASS!,
    },
    logger: false,
};

export const transporter = nodemailer.createTransport(SMTP_CONFIG);

export async function sendEmail(to: string, subject: string, text: string) {
    const info = await transporter.sendMail({
        from: process.env.SMTP_USER!,
        to,
        subject,
        text,
    });
    return info;
}

export async function fetchUnseenEmails() {
    const client = new ImapFlow(IMAP_CONFIG);
    await client.connect();

    try {
        const lock = await client.getMailboxLock("INBOX");
        try {
            const seenUids = getSeenUids();
            const messages: EmailMessage[] = [];

            for await (const msg of client.fetch({ seen: false }, { source: true })) {
                if (seenUids.has(msg.uid)) continue;
                const parsed = await simpleParser(msg.source!);
                messages.push({
                    subject: parsed.subject ?? "",
                    from: parsed.from?.text ?? "",
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

export async function markAsSeen(uids: number[]) {
    const client = new ImapFlow(IMAP_CONFIG);
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

const FETCH_INTERVAL_MS = Number(process.env.FETCH_INTERVAL_MS!) || 30000;

export type EmailMessage = { subject: string; from: string; text: string; uid: number; date: string };

export function onReceive(): Promise<EmailMessage> {
    return new Promise(async (resolve) => {
        const poll = async () => {
            const messages = await fetchUnseenEmails();
            if (messages.length > 0) {
                const msg = messages[0];
                await markAsSeen([msg.uid]);
                saveSeenUid(msg.uid);
                resolve(msg);
            } else {
                process.stdout.write(`No New Emails Since ${(new Date()).toLocaleTimeString("en-US")}\r`);
                setTimeout(poll, FETCH_INTERVAL_MS);
            }
        };
        poll();
    });
}
