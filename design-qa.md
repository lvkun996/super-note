# Design QA

- Source visual truth: `C:\Users\lv_ku\AppData\Local\Temp\codex-clipboard-ae7a1158-030c-4c06-89a4-77a07ee0eaac.png` (660 × 91) and `C:\Users\lv_ku\AppData\Local\Temp\codex-clipboard-60c19a94-e57e-44cb-99d3-512223ce1eea.png` (1144 × 826).
- Implementation capture: Codex in-app Browser tab 1 inline captures of the settings dialog, Markdown preview, and Markdown editor dialog; the CUA capture API did not expose a filesystem path.
- Website capture: Codex in-app Browser tab 2 inline captures at 1280 × 720 and 390 × 844.
- CSS viewport and density: desktop 1280 × 720 at 1×; narrow website 390 × 844 at 1×. The source component crops were compared at native density without resampling.
- State: light theme; empty save path; newly created Markdown document; Markdown editor populated with heading, paragraph, and list content.

## Full-view comparison evidence

- The settings dialog keeps the reference row hierarchy while the directory input now spans the available content width and leaves a fixed-width Select button at the right.
- The Markdown document opens as a clean preview. The standalone Markdown label and Edit/Preview segmented row are gone. Edit is the first control in the title row.
- The editor dialog uses a large centered translucent surface with source and live preview columns. Updating the source immediately updated the heading, paragraph, and list in both the main preview and dialog preview.
- The refreshed website keeps the existing Super Note visual system, uses a quieter neutral palette, and remains readable without horizontal overflow at 390 px.

## Focused region comparison evidence

- Save directory field: the reference shows a cramped path control; the implementation visibly provides roughly the full modal content width before the Select button.
- Markdown header: the reference highlights the redundant Markdown toolbar; the implementation contains only Edit, the document title, and the document actions menu in one 46 px row.
- Markdown edit state: source/preview labels, divider, editor padding, close control, and Done action remain aligned at 1280 × 720.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- P3: the website hero uses the existing multi-pane product screenshot, which does not yet depict the new Markdown dialog. It remains a real product asset and does not affect task completion.

## Interaction checks

- Created a Markdown document and confirmed preview is the default state.
- Opened the editor from the leftmost title-bar button, changed Markdown source, and confirmed immediate preview updates.
- Opened Settings and confirmed the save directory field width.
- Checked website desktop and 390 px layouts, toggled light/dark theme, and checked browser console output. The website had no errors; the app only reported its existing Ant Design React 19 compatibility warning.

## Comparison history

- First implementation pass: no P0/P1/P2 issues found. No visual correction loop was required.

## Implementation checklist

- [x] JSON open-time formatting with invalid-input fallback
- [x] Wider default-save-directory control
- [x] Markdown preview-first document view
- [x] Leftmost title-bar edit action
- [x] Separate live Markdown editing dialog
- [x] Responsive website refresh and v0.1.26 links

final result: passed
