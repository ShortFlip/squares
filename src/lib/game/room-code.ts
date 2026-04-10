// Excludes visually ambiguous characters so codes are easy to read aloud over a call:
// O looks like 0, I looks like 1, L looks like 1
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
  ).join('');
}

/** Strip invalid characters and uppercase — call before DB lookup */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '');
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}
