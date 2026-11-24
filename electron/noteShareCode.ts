import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompress, brotliDecompress, constants } from "node:zlib";

export type SharedTextNote = { title: string; content: string; mode: "text" | "markdown" };
export type NoteShareResult =
  | { ok: false; reason: "invalid" | "too-large" | "unsupported" }
  | { ok: false; reason: "code-too-long"; maxLength: number; actualLength?: number };

const LEGACY_PREFIX = "SN1.";
const PREFIX = "SN2.";
const CHECKSUM_BYTES = 8;
const MAX_NOTE_BYTES = 4 * 1024 * 1024;
const MAX_CODE_LENGTH = 1024;
const FIRST_IDEOGRAPH = 0x4e00;
const BITS_PER_CHAR = 14;
const CHAR_MASK = (1 << BITS_PER_CHAR) - 1;
const HIGH_QUALITY_INPUT_LIMIT = 128 * 1024;
const HIGH_QUALITY_RETRY_LIMIT = 4096;
const compress = promisify(brotliCompress);
const decompress = promisify(brotliDecompress);
const checksum = (data: Buffer) => createHash("sha256").update(data).digest().subarray(0, CHECKSUM_BYTES);
const codeTooLong = (actualLength?: number): NoteShareResult => ({
  ok: false, reason: "code-too-long", maxLength: MAX_CODE_LENGTH, ...(actualLength === undefined ? {} : { actualLength }),
});
const invalidCode = { ok: false, reason: "invalid" } as const;

// A contiguous set of BMP Han characters packs 14 bits in each character.
// The sentinel bit records the final group's padding without a length field.
function packIdeographs(bytes: Buffer) {
  let result = "";
  let pending = 0;
  let bits = 0;
  for (const byte of bytes) {
    pending = (pending << 8) | byte;
    bits += 8;
    if (bits >= BITS_PER_CHAR) {
      bits -= BITS_PER_CHAR;
      result += String.fromCharCode(FIRST_IDEOGRAPH + ((pending >>> bits) & CHAR_MASK));
    }
  }
  const finalWord = (((pending << 1) | 1) << (BITS_PER_CHAR - bits - 1)) & CHAR_MASK;
  return result + String.fromCharCode(FIRST_IDEOGRAPH + finalWord);
}

function unpackIdeographs(text: string): Buffer | null {
  let finalWord = text.charCodeAt(text.length - 1) - FIRST_IDEOGRAPH;
  if (!(finalWord > 0 && finalWord <= CHAR_MASK)) return null;
  let padding = 1;
  while ((finalWord & 1) === 0) {
    padding += 1;
    finalWord >>>= 1;
  }
  const bitLength = text.length * BITS_PER_CHAR - padding;
  if (bitLength % 8 !== 0) return null;

  const bytes = Buffer.alloc(bitLength / 8);
  let pending = 0;
  let bits = 0;
  let index = 0;
  for (let offset = 0; offset < text.length; offset += 1) {
    const word = text.charCodeAt(offset) - FIRST_IDEOGRAPH;
    if (word < 0 || word > CHAR_MASK) return null;
    pending = (pending << BITS_PER_CHAR) | word;
    bits += offset === text.length - 1 ? BITS_PER_CHAR - padding : BITS_PER_CHAR;
    if (offset === text.length - 1) pending >>>= padding;
    while (bits >= 8) {
      bits -= 8;
      bytes[index++] = (pending >>> bits) & 0xff;
    }
  }
  return bytes;
}

function packNote(note: SharedTextNote, encoding: "utf8" | "utf16le") {
  const title = Buffer.from(note.title, encoding);
  let length = title.length;
  const header = [(note.mode === "markdown" ? 1 : 0) | (encoding === "utf16le" ? 2 : 0)];
  while (length >= 128) {
    header.push((length & 127) | 128);
    length >>>= 7;
  }
  header.push(length);
  return Buffer.concat([Buffer.from(header), title, Buffer.from(note.content, encoding)]);
}

function unpackNote(data: Buffer): SharedTextNote | null {
  if (data[0] === 0x5b) {
    const fields: unknown = JSON.parse(data.toString("utf8"));
    if (!Array.isArray(fields) || fields.length !== 3) return null;
    const [mode, title, content] = fields;
    if ((mode !== 0 && mode !== 1) || typeof title !== "string" || !title.trim() || typeof content !== "string") return null;
    return { title, content, mode: mode === 0 ? "text" : "markdown" };
  }

  const flags = data[0];
  if (data.length < 3 || flags > 3) return null;
  let offset = 1;
  let titleLength = 0;
  let shift = 0;
  for (;;) {
    if (offset >= data.length || shift > 21) return null;
    const byte = data[offset++];
    titleLength |= (byte & 127) << shift;
    if ((byte & 128) === 0) break;
    shift += 7;
  }
  const end = offset + titleLength;
  if (end > data.length) return null;
  const utf16 = (flags & 2) !== 0;
  if (utf16 && ((titleLength % 2) !== 0 || ((data.length - end) % 2) !== 0)) return null;
  const encoding = utf16 ? "utf16le" : "utf8";
  const title = data.toString(encoding, offset, end);
  const content = data.toString(encoding, end);
  if (!title.trim()) return null;
  if (!utf16 && (!Buffer.from(title).equals(data.subarray(offset, end)) ||
      !Buffer.from(content).equals(data.subarray(end)))) return null;
  return { title, content, mode: (flags & 1) === 0 ? "text" : "markdown" };
}

const brotli = (data: Buffer, quality: number) =>
  compress(data, {
    params: {
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_QUALITY]: quality,
      [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
    },
  });

async function compressCandidate(data: Buffer) {
  if (data.length <= HIGH_QUALITY_INPUT_LIMIT) return brotli(data, 11);
  // Very long, poorly compressible notes are already far above the code limit.
  const quick = await brotli(data, 6);
  if (quick.length > HIGH_QUALITY_RETRY_LIMIT) return quick;
  const best = await brotli(data, 11);
  return best.length < quick.length ? best : quick;
}

export async function encodeNoteShareCode(value: unknown): Promise<{ ok: true; code: string } | NoteShareResult> {
  const note = value as SharedTextNote | null;
  if (!note || typeof note.title !== "string" || !note.title.trim() || typeof note.content !== "string" ||
      (note.mode !== "text" && note.mode !== "markdown")) return invalidCode;
  const { title, content, mode } = note;
  if (title.length + content.length > MAX_NOTE_BYTES) return { ok: false, reason: "too-large" };
  const json = Buffer.from(JSON.stringify([Number(mode === "markdown"), title, content]));
  if (json.length > MAX_NOTE_BYTES) return { ok: false, reason: "too-large" };

  let shortest = await compressCandidate(json);
  const hasUnpairedSurrogate = /[\uD800-\uDFFF]/u;
  for (const encoding of ["utf8", "utf16le"] as const) {
    if (encoding === "utf8" && (hasUnpairedSurrogate.test(title) || hasUnpairedSurrogate.test(content))) continue;
    const packed = packNote({ title, content, mode }, encoding);
    if (packed.length > MAX_NOTE_BYTES) continue;
    const compressed = await compressCandidate(packed);
    if (compressed.length < shortest.length) shortest = compressed;
  }
  const length = PREFIX.length + Math.ceil(((CHECKSUM_BYTES + shortest.length) * 8 + 1) / BITS_PER_CHAR);
  if (length > MAX_CODE_LENGTH) return codeTooLong(length);
  return { ok: true, code: PREFIX + packIdeographs(Buffer.concat([checksum(shortest), shortest])) };
}

export async function decodeNoteShareCode(value: unknown): Promise<{ ok: true; note: SharedTextNote } | NoteShareResult> {
  if (typeof value !== "string") return invalidCode;
  if (value.length > MAX_CODE_LENGTH * 2) return codeTooLong();
  const code = value.replace(/\s/g, "");
  if (code.length > MAX_CODE_LENGTH) return codeTooLong();
  const legacy = code.startsWith(LEGACY_PREFIX);
  if (!legacy && !code.startsWith(PREFIX)) return { ok: false, reason: /^SN\d+\./.test(code) ? "unsupported" : "invalid" };
  const encoded = code.slice(PREFIX.length);
  const bytes = legacy ? Buffer.from(encoded, "base64url") : unpackIdeographs(encoded);
  if (!bytes || bytes.length <= CHECKSUM_BYTES || (legacy && bytes.toString("base64url") !== encoded)) return invalidCode;
  const digest = bytes.subarray(0, CHECKSUM_BYTES);
  const compressed = bytes.subarray(CHECKSUM_BYTES);
  if (!legacy && !checksum(compressed).equals(digest)) return invalidCode;
  try {
    const data = await decompress(compressed, { maxOutputLength: MAX_NOTE_BYTES });
    if (legacy && (!checksum(data).equals(digest) || data[0] !== 0x5b)) return invalidCode;
    const note = unpackNote(data);
    return note ? { ok: true, note } : invalidCode;
  } catch (error) {
    return { ok: false, reason: (error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE" ? "too-large" : "invalid" };
  }
}
