import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompress, brotliDecompress, constants } from "node:zlib";

export type SharedTextNote = { title: string; content: string; mode: "text" | "markdown" };
export type NoteShareResult =
  | { ok: false; reason: "invalid" | "too-large" | "unsupported" }
  | { ok: false; reason: "code-too-long"; maxLength: number };

const PREFIX = "SN1.";
const CHECKSUM_BYTES = 8;
const MAX_NOTE_BYTES = 4 * 1024 * 1024;
const MAX_CODE_LENGTH = 1024;
const compress = promisify(brotliCompress);
const decompress = promisify(brotliDecompress);
const checksum = (data: Buffer) => createHash("sha256").update(data).digest().subarray(0, CHECKSUM_BYTES);
const codeTooLong = (): NoteShareResult => ({ ok: false, reason: "code-too-long", maxLength: MAX_CODE_LENGTH });

export async function encodeNoteShareCode(value: unknown): Promise<{ ok: true; code: string } | NoteShareResult> {
  const note = value as Partial<SharedTextNote> | null;
  if (!note || typeof note.title !== "string" || !note.title.trim() || typeof note.content !== "string" ||
      (note.mode !== "text" && note.mode !== "markdown")) return { ok: false, reason: "invalid" };
  if (note.title.length + note.content.length > MAX_NOTE_BYTES) return { ok: false, reason: "too-large" };
  const data = Buffer.from(JSON.stringify([Number(note.mode === "markdown"), note.title, note.content]));
  if (data.length > MAX_NOTE_BYTES) return { ok: false, reason: "too-large" };
  const compressed = await compress(data, {
    params: {
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
    },
  });
  const code = PREFIX + Buffer.concat([checksum(data), compressed]).toString("base64url");
  return code.length <= MAX_CODE_LENGTH ? { ok: true, code } : codeTooLong();
}

export async function decodeNoteShareCode(value: unknown): Promise<{ ok: true; note: SharedTextNote } | NoteShareResult> {
  if (typeof value !== "string") return { ok: false, reason: "invalid" };
  if (value.length > MAX_CODE_LENGTH * 2) return codeTooLong();
  const code = value.replace(/\s/g, "");
  if (code.length > MAX_CODE_LENGTH) return codeTooLong();
  if (!code.startsWith(PREFIX)) return { ok: false, reason: /^SN\d+\./.test(code) ? "unsupported" : "invalid" };
  const encoded = code.slice(PREFIX.length);
  if (!/^[\w-]+$/.test(encoded)) return { ok: false, reason: "invalid" };
  const bytes = Buffer.from(encoded, "base64url");
  if (bytes.length <= CHECKSUM_BYTES || bytes.toString("base64url") !== encoded) return { ok: false, reason: "invalid" };
  try {
    const data = await decompress(bytes.subarray(CHECKSUM_BYTES), { maxOutputLength: MAX_NOTE_BYTES });
    if (!checksum(data).equals(bytes.subarray(0, CHECKSUM_BYTES))) return { ok: false, reason: "invalid" };
    const fields: unknown = JSON.parse(data.toString("utf8"));
    if (!Array.isArray(fields) || fields.length !== 3) return { ok: false, reason: "invalid" };
    const [mode, title, content] = fields;
    if ((mode !== 0 && mode !== 1) || typeof title !== "string" || !title.trim() || typeof content !== "string") {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, note: { title, content, mode: mode === 0 ? "text" : "markdown" } };
  } catch (error) {
    return { ok: false, reason: (error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE" ? "too-large" : "invalid" };
  }
}
