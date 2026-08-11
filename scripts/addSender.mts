import "dotenv/config";
import { loadCharacter } from "../src/character.ts";
import { ensureSender } from "../src/ai.ts";

const [name, ...senders] = process.argv.slice(2);
if (!name || senders.length === 0) {
    console.error("Usage: pnpm add-sender <character> <email-address> [more...]");
    process.exit(1);
}

const char = loadCharacter(name);
if (!char) {
    console.error(`Character "${name}" not found (needs characters/${name}/conf.toml + prompt.md)`);
    process.exit(1);
}

for (const sender of senders) {
    const created = ensureSender(char, sender);
    console.log(created ? `Added sender: ${sender}` : `Sender already exists: ${sender}`);
}
