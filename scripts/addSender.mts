import "dotenv/config";
import { ensureSender } from "../src/ai.ts";

const senders = process.argv.slice(2);
if (senders.length === 0) {
    console.error("Usage: pnpm add-sender <email-address> [more...]");
    process.exit(1);
}

for (const sender of senders) {
    const created = ensureSender(sender);
    console.log(created ? `Added sender: ${sender}` : `Sender already exists: ${sender}`);
}
