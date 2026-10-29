import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NoteReferenceText } from "./NoteReferenceText";
import { createNoteReference, filterNoteTargets } from "./noteReferences";

describe("plain text note reference display", () => {
  it("shows current names without displaying markdown syntax or the note URL", () => {
    const target = { id: "space/id", title: "Current <name>", kind: "file" as const };
    const html = renderToStaticMarkup(<NoteReferenceText
      content={`**plain text**\n${createNoteReference({ ...target, title: "Old name" })}\nhttps://example.com`}
      query="Current" targets={[target]} />);
    expect(html).toContain('href="super-note://note/space%2Fid"');
    expect(html).toContain('<mark class="search-mark">Current</mark>');
    expect(html).toContain("&lt;name&gt;");
    expect(html).not.toContain("Old name");
    expect(html).not.toContain("](super-note");
    expect(html).toContain("**plain text**");
    expect(html).toContain("https://example.com");
  });

  it("keeps saved names for unavailable notes and repeated links", () => {
    const link = createNoteReference({ id: "closed", title: "A [note]", kind: "canvas" });
    const html = renderToStaticMarkup(<NoteReferenceText content={`${link}\n${link}`} query="" targets={[]} />);
    expect(html.match(/>A \[note\]<\/a>/g)).toHaveLength(2);
  });

  it("stops reading targets once the visible result limit is filled", () => {
    let visits = 0;
    const targets = Array.from({ length: 10000 }, (_, index) => ({
      id: String(index), kind: "file" as const,
      get title() { visits++; return "matching note"; },
    }));
    expect(filterNoteTargets(targets, "0", "matching")).toHaveLength(30);
    expect(visits).toBe(30);
  });
});
