/**
 * Reduce an RFC-5322 address string to the bare email (trimmed + lowercased).
 * `"Name" <user@host>`, `Name <user@host>` and `user@host` all map to `user@host`,
 * so one person always hits one conversation file no matter how their mail client
 * formats the From/To header.
 */
export function normalizeSender(raw: string): string {
    const s = raw.trim();
    if (!s) return s;
    const angle = s.match(/<([^<>]+)>/);
    if (angle) return angle[1].trim().toLowerCase();
    const token = s.split(/[\s,]+/).find((t) => t.includes("@"));
    if (token) return token.trim().toLowerCase();
    return s.toLowerCase();
}
