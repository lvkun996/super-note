import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeNoteShareCode, encodeNoteShareCode } from "./noteShareCode";

describe("offline share codes", () => {
  it("compresses Unicode Markdown and restores the exact snapshot from a wrapped code", async () => {
    const note = {
      title: "项目计划 📝",
      mode: "markdown",
      content: ("## 任务\n\n| 负责人 | 截止日期 |\n| --- | --- |\n| 张三 | 周五 ✅ |\n\n").repeat(100),
    } as const;
    const result = await encodeNoteShareCode(note);
    if (!result.ok) throw new Error(result.reason);
    expect(result.code.length).toBeLessThan(Buffer.byteLength(note.content) / 5);
    expect(await decodeNoteShareCode(`  ${result.code.slice(0, 45)}\r\n${result.code.slice(45)}  `)).toEqual({ ok: true, note });
    const invalid = result.code.slice(0, 4) + (result.code[4] === "A" ? "B" : "A") + result.code.slice(5);
    expect(await decodeNoteShareCode(invalid)).toEqual({ ok: false, reason: "invalid" });
  });

  it("preserves empty plain text and rejects oversized payloads and unsupported versions", async () => {
    const note = { title: "Empty", content: "", mode: "text" };
    const result = await encodeNoteShareCode(note);
    if (!result.ok) throw new Error(result.reason);
    expect(await decodeNoteShareCode(result.code)).toEqual({ ok: true, note });
    expect(await decodeNoteShareCode("SN2.ABCD")).toEqual({ ok: false, reason: "unsupported" });
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
    expect(await encodeNoteShareCode({ ...note, content: randomBytes(2048).toString("hex") })).toEqual(tooLong);
    expect(await decodeNoteShareCode("SN1." + "A".repeat(1020))).toEqual({ ok: false, reason: "invalid" });
    expect(await decodeNoteShareCode("SN1." + "A".repeat(1021))).toEqual(tooLong);
  });
});
