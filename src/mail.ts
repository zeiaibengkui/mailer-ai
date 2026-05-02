import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

const SMTP_CONFIG = {
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT!),
    secure: true,
    auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
    },
};

const IMAP_CONFIG = {
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT!),
    secure: true,
    auth: {
        user: process.env.IMAP_USER!,
        pass: process.env.IMAP_PASS!,
    },
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
            const messages: EmailMessage[] = [];

            for await (const msg of client.fetch({ seen: false }, { source: true, envelope: true })) {
                const text = msg.source?.toString() ?? "";
                messages.push({
                    subject: msg.envelope?.subject ?? "",
                    from: msg.envelope?.from?.[0]?.address ?? "",
                    text,
                    uid: msg.uid,
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

export type EmailMessage = { subject: string; from: string; text: string; uid: number };

export function onReceive(): Promise<EmailMessage> {
    return new Promise(async (resolve) => {
        const poll = async () => {
            const messages = await fetchUnseenEmails();
            if (messages.length > 0) {
                const msg = messages[0];
                await markAsSeen([msg.uid]);
                resolve(msg);
            } else {
                setTimeout(poll, FETCH_INTERVAL_MS);
            }
        };
        poll();
    });
}
