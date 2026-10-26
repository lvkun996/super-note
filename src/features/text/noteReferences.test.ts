import { describe, expect, it } from "vitest";
import { createNoteReference, filterNoteTargets, getNoteReferenceQuery, getNoteReferences, noteIdFromUrl } from "./noteReferences";
import { findLocalFileAtOffset, getLocalFileLinks } from "./localFileLinks";
import { renderMarkdownContent } from "./markdownRenderer";

describe("note references", () => {
  it("round trips escaped titles and stable identifiers", () => {
    const target = { id: "中文/space id", title: "我的 [笔记] \\ draft", kind: "file" as const };
    const link = createNoteReference(target);
    const [reference] = getNoteReferences(link);
    expect(reference.id).toBe(target.id);
    expect(reference.title).toBe(target.title);
    expect(reference.end).toBe(link.length);
    expect(renderMarkdownContent(link)).toContain(`href="super-note://note/${encodeURIComponent(target.id)}"`);
    expect(noteIdFromUrl("super-note://note/%bad")).toBeNull();
    expect(noteIdFromUrl("https://example.com")).toBeNull();
  });
  it("finds an active dollar query without hijacking selections or escaped dollars", () => {
    expect(getNoteReferenceQuery("参考$笔记", 5, 5)).toEqual({ start: 2, end: 5, query: "笔记" });
    expect(getNoteReferenceQuery("$", 1, 1)?.query).toBe("");
    expect(getNoteReferenceQuery("$abc", 0, 4)).toBeNull();
    expect(getNoteReferenceQuery("\\$abc", 5, 5)).toBeNull();
    expect(getNoteReferenceQuery("$$abc", 5, 5)).toBeNull();
    expect(getNoteReferenceQuery("$abc\n", 5, 5)).toBeNull();
    expect(filterNoteTargets([{ id: "a", title: "Alpha", kind: "file" }, { id: "b", title: "ALPHA board", kind: "canvas" }], "a", "alpha").map(note => note.id)).toEqual(["b"]);
  });
});

describe("local file links", () => {
  it("finds drive and UNC paths inside prose without swallowing punctuation", () => {
    const text = String.raw`参考 D:\code\zd\front\h5\web\upload.py，另一个 \\server\share\note.txt。`;
    const links = getLocalFileLinks(text);
    expect(links.map(link => link.path)).toEqual([String.raw`D:\code\zd\front\h5\web\upload.py`, String.raw`\\server\share\note.txt`]);
    expect(findLocalFileAtOffset(text, links[0].start + 10)).toBe(links[0].path);
    expect(findLocalFileAtOffset(text, links[0].end)).toBeNull();
  });
  it("supports quoted paths with spaces and does not interpret web URLs as files", () => {
    const text = String.raw`打开 "D:\My Notes\file name.md" 或 C:/notes/a.txt)`;
    expect(getLocalFileLinks(text).map(link => link.path)).toEqual([String.raw`D:\My Notes\file name.md`, "C:/notes/a.txt"]);
    expect(getLocalFileLinks("https://example.com/a/b.py")).toEqual([]);
    expect(getLocalFileLinks("https://example.com/D:/notes/a.py")).toEqual([]);
  });
});
