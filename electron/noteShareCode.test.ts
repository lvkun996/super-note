import { createHash } from "node:crypto";
import { brotliCompressSync, constants } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeNoteShareCode, encodeNoteShareCode, type SharedTextNote } from "./noteShareCode";

function previousCode(note: SharedTextNote) {
  const data = Buffer.from(JSON.stringify([Number(note.mode === "markdown"), note.title, note.content]));
  const digest = createHash("sha256").update(data).digest().subarray(0, 8);
  const compressed = brotliCompressSync(data, { params: {
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
    [constants.BROTLI_PARAM_QUALITY]: 11,
    [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
  } });
  return "SN1." + Buffer.concat([digest, compressed]).toString("base64url");
}

const identifiers = Array.from({ length: 60 }, (_, index) => createHash("sha256").update(`note-${index}`).digest("hex"));

describe("offline share codes", () => {
  it("compresses Unicode Markdown and restores the exact snapshot from a wrapped code", async () => {
    const note = {
      title: "项目计划 📝",
      mode: "markdown",
      content: ("## 任务\n\n| 负责人 | 截止日期 |\n| --- | --- |\n| 张三 | 周五 ✅ |\n\n").repeat(100),
    } as const;
    const result = await encodeNoteShareCode(note);
    if (!result.ok) throw new Error(result.reason);
    expect(result.code).toMatch(/^SN2\.[\u4e00-\u8dff]+$/u);
    expect(result.code.length).toBeLessThan(Buffer.byteLength(note.content) / 5);
    expect(result.code.normalize("NFKC")).toBe(result.code);
    expect(await decodeNoteShareCode(`  ${result.code.slice(0, 45)}\r\n${result.code.slice(45)}  `)).toEqual({ ok: true, note });
    const invalid = result.code.slice(0, 4) + (result.code[4] === "一" ? "丁" : "一") + result.code.slice(5);
    expect(await decodeNoteShareCode(invalid)).toEqual({ ok: false, reason: "invalid" });
    expect(await decodeNoteShareCode(result.code.slice(0, -1))).toEqual({ ok: false, reason: "invalid" });
    expect(await decodeNoteShareCode(previousCode(note))).toEqual({ ok: true, note });
  });

  it("preserves empty plain text and rejects oversized payloads and unsupported versions", async () => {
    const note = { title: "Empty", content: "", mode: "text" };
    const result = await encodeNoteShareCode(note);
    if (!result.ok) throw new Error(result.reason);
    expect(await decodeNoteShareCode(result.code)).toEqual({ ok: true, note });
    expect(await decodeNoteShareCode("SN3.ABCD")).toEqual({ ok: false, reason: "unsupported" });
    expect(await decodeNoteShareCode("ordinary text")).toEqual({ ok: false, reason: "invalid" });
    expect(await encodeNoteShareCode({ ...note, content: "中".repeat(1_500_000) })).toEqual({ ok: false, reason: "too-large" });
  });

  it("limits the encoded code length after compression", async () => {
    const note = { title: "Length", content: "可压缩的正文。".repeat(10_000), mode: "text" };
    const result = await encodeNoteShareCode(note);
    if (!result.ok) throw new Error(result.reason);
    expect(result.code.length).toBeLessThanOrEqual(1024);
    expect(await decodeNoteShareCode(result.code)).toEqual({ ok: true, note });

    const tooLong = { ok: false, reason: "code-too-long", maxLength: 1024 };
    expect(await encodeNoteShareCode({ ...note, content: identifiers.join("\n") })).toEqual({
      ...tooLong, actualLength: expect.any(Number),
    });
    expect(await decodeNoteShareCode("SN1." + "A".repeat(1020))).toEqual({ ok: false, reason: "invalid" });
    expect(await decodeNoteShareCode("SN1." + "A".repeat(1021))).toEqual(tooLong);
  });

  it("fits a note that exceeded the previous limit", async () => {
    const note = { title: "测试记录 📝", mode: "markdown", content: identifiers.slice(0, 35).join("\n") } as const;
    const original = previousCode(note);
    expect(original.length).toBeGreaterThan(1024);
    const result = await encodeNoteShareCode(note);
    if (!result.ok) throw new Error(result.reason);
    expect(result.code.length).toBeLessThan(original.length * 0.45);
    expect(await decodeNoteShareCode(result.code)).toEqual({ ok: true, note });
  });

  it("keeps a long title and unusual UTF-16 contents byte for byte", async () => {
    const title = "工作记录".repeat(30) + "\ud800";
    const note = { title, content: "e\u0301\r\n\u0000🚀\udfff\r\n", mode: "text" } as const;
    const result = await encodeNoteShareCode(note);
    if (!result.ok) throw new Error(result.reason);
    expect(await decodeNoteShareCode(result.code)).toEqual({ ok: true, note });
  });
});
